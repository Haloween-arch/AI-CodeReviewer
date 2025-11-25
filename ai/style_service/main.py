from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile, subprocess, sys, re, os, json
from dotenv import load_dotenv

# -------------------------------------------------------
#  Gemini Setup
# -------------------------------------------------------
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_READY = False
MODEL_NAME = "gemini-2.5-flash-preview-09-2025"

try:
    import google.generativeai as genai
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)
        GEMINI_READY = True
        print(f"✅ Gemini ready for Style Service using {MODEL_NAME}")
    else:
        print("⚠ GEMINI_API_KEY missing")
except Exception:
    GEMINI_READY = False
    print("⚠ Gemini library not available")


# -------------------------------------------------------
#  FastAPI Init
# -------------------------------------------------------
app = FastAPI(title="Style Service v4 — Noise Filter + Weighted Score")


# -------------------------------------------------------
#  Request Model
# -------------------------------------------------------
class StyleInput(BaseModel):
    code: str
    language: str | None = None


# -------------------------------------------------------
#  Regex Patterns
# -------------------------------------------------------
PYLINT_RE = re.compile(r".+:(\d+):(\d+):\s*([A-Z]\d+):\s*(.+)$")
FLAKE8_RE = re.compile(r"(\d+):(\d+):\s*([A-Z]\d+)\s+(.+)")


# -------------------------------------------------------
#  Noise Filter Rules
# -------------------------------------------------------
IGNORED_CODES = {
    "C0114", "C0115", "C0116",   # Missing docstring
    "C0304",                     # Missing final newline
    "C0303",                     # Trailing whitespace
    "W291", "W293", "W292",      # Blank / whitespace
    "E501",                      # Line too long
}

def is_noise(issue):
    """Return True if the lint message is not meaningful."""
    code = issue.get("code", "")
    msg = issue.get("message","").lower()

    if code in IGNORED_CODES:
        return True

    # very common unhelpful warnings
    noise_keywords = [
        "missing module docstring",
        "no newline at end of file",
        "trailing whitespace",
        "line too long",
        "whitespace",
        "indentation"
    ]
    return any(k in msg for k in noise_keywords)


# -------------------------------------------------------
#  Local Python Linting
# -------------------------------------------------------
def local_python_lint(tmp_file: str):
    issues = []

    # pylint
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pylint", tmp_file,
             "--disable=all", "--enable=C,W,E,R",
             "--score=no", "--reports=no"],
            capture_output=True, text=True, timeout=10
        )
        for line in (proc.stdout + proc.stderr).splitlines():
            m = PYLINT_RE.match(line.strip())
            if m:
                ln, col, cid, msg = m.groups()
                item = {
                    "tool": "pylint",
                    "line": int(ln),
                    "column": int(col),
                    "code": cid,
                    "severity": (
                        "error" if cid.startswith(("E", "R", "F"))
                        else "warning"
                    ),
                    "message": msg
                }
                if not is_noise(item):
                    issues.append(item)

    except Exception as e:
        issues.append({"tool": "pylint", "error": str(e)})

    # flake8
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "flake8", tmp_file,
             "--format=%(row)d:%(col)d:%(code)s %(text)s"],
            capture_output=True, text=True, timeout=10
        )
        for line in (proc.stdout + proc.stderr).splitlines():
            m = FLAKE8_RE.match(line.strip())
            if m:
                ln, col, cid, msg = m.groups()
                item = {
                    "tool": "flake8",
                    "line": int(ln),
                    "column": int(col),
                    "code": cid,
                    "severity": "style",
                    "message": msg
                }
                if not is_noise(item):
                    issues.append(item)

    except Exception as e:
        issues.append({"tool": "flake8", "error": str(e)})

    return issues


# -------------------------------------------------------
#  Language Detection
# -------------------------------------------------------
def detect_language(code: str) -> str:
    c = code.lower()
    if "def " in c:            return "python"
    if "#include" in c:        return "cpp"
    if "public static void" in c: return "java"
    if "function " in c or "console.log" in c: return "javascript"
    return "javascript"


# -------------------------------------------------------
#  Gemini Review
# -------------------------------------------------------
def gemini_style_review(code: str, lang: str):
    if not GEMINI_READY:
        return {"ai_used": False, "issues": [], "summary": "AI disabled"}

    instruction = f"""
You are a senior {lang.upper()} code reviewer.
Only analyze STYLE, READABILITY, NAMING, CLEAN CODE, and BEST PRACTICES.
Ignore whitespace, blank lines, formatting noise.

Respond ONLY in this JSON structure:
{{
  "issues": [
    {{
      "line": <int>,
      "category": "formatting|naming|readability|best_practices|dead_code",
      "message": "<string>"
    }}
  ],
  "summary": "<string>"
}}
"""

    user_prompt = f"Review this {lang} code:\n```\n{code}\n```"

    try:
        model = genai.GenerativeModel(MODEL_NAME, system_instruction=instruction)
        cfg = genai.GenerationConfig(response_mime_type="application/json")

        resp = model.generate_content(user_prompt, generation_config=cfg)
        parsed = json.loads(resp.text)

        return {
            "ai_used": True,
            "issues": parsed.get("issues", []),
            "summary": parsed.get("summary", "")
        }

    except Exception as e:
        return {"ai_used": True, "issues": [], "summary": f"AI error: {e}"}


# -------------------------------------------------------
#  Main Endpoint
# -------------------------------------------------------
@app.post("/analyze/style")
async def analyze_style(payload: StyleInput):

    code = payload.code.strip()
    if not code:
        return JSONResponse({"error": "Empty code"}, status_code=400)

    lang = (payload.language or detect_language(code))

    # ---- Linting ----
    local_issues = []
    tmp_file = None

    if lang == "python":
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w") as f:
            f.write(code)
            tmp_file = f.name

        local_issues = local_python_lint(tmp_file)

        if tmp_file and os.path.exists(tmp_file):
            os.remove(tmp_file)

    # ---- AI Review ----
    ai_review = gemini_style_review(code, lang)

    # ---- Stats (noise filtered) ----
    local_count = len([x for x in local_issues if "error" not in x])
    ai_count = len(ai_review.get("issues", []))

    return {
        "language_detected": lang,
        "ai_model": MODEL_NAME if GEMINI_READY else None,
        "review_summary": {
            "local_issues_found": local_count,
            "ai_issues_found": ai_count,
            "ai_feedback": ai_review.get("summary", ""),
            "weighted_score_ready": True,
            "note": "Noise-filtered hybrid review"
        },
        "local_issues": local_issues,
        "ai_review": ai_review
    }


@app.get("/")
def home():
    return {
        "service": "Style Service v4",
        "noise_filter": True,
        "gemini_ready": GEMINI_READY
    }
