from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile, subprocess, sys, re, os, json
from dotenv import load_dotenv

# -------------------------------------------------------
# ✅ Gemini Setup
# -------------------------------------------------------
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_READY = False
# Note: Using a model that supports JSON output. 
# Update this to a production model when available.
MODEL_NAME = "gemini-2.5-flash-preview-09-2025" 

try:
    import google.generativeai as genai
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)
        GEMINI_READY = True
        print(f"✅ Gemini ready for Style Service using {MODEL_NAME}")
    else:
        print("⚠ Gemini API key not found. Set GEMINI_API_KEY environment variable.")
except ImportError:
    print("⚠ 'google.generativeai' not installed. AI features will be disabled.")
    GEMINI_READY = False
except Exception as e:
    print(f"⚠ Gemini initialization failed: {e}")
    GEMINI_READY = False


# -------------------------------------------------------
# ✅ FastAPI Init
# -------------------------------------------------------
app = FastAPI(title="Style Service v3 (Hybrid + Multilingual)")


# -------------------------------------------------------
# ✅ Request Model
# -------------------------------------------------------
class StyleInput(BaseModel):
    code: str
    language: str | None = None


# -------------------------------------------------------
# ✅ Regex for Python Linting
# -------------------------------------------------------
PYLINT_RE = re.compile(r".+:(\d+):(\d+):\s*([A-Z]\d+):\s*(.+)$")
FLAKE8_RE = re.compile(r"(\d+):(\d+):\s*([A-Z]\d+)\s+(.+)")


# -------------------------------------------------------
# ✅ Local Python Linting
# -------------------------------------------------------
def local_python_lint(tmp_file: str):
    issues = []

    # ---- pylint ----
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pylint", tmp_file,
             "--disable=all", "--enable=C,W,E,R",
             "--score=no", "--reports=no"],
            capture_output=True, text=True, timeout=10, encoding='utf-8'
        )
        for line in (proc.stdout + proc.stderr).splitlines():
            m = PYLINT_RE.match(line.strip())
            if m:
                ln, col, cid, msg = m.groups()
                issues.append({
                    "tool": "pylint",
                    "line": int(ln),
                    "column": int(col),
                    "code": cid,
                    "severity": "error" if cid.startswith(("E", "R", "F")) else "warning",
                    "message": msg
                })
    except FileNotFoundError:
        issues.append({"tool": "pylint", "error": "pylint not found. Is it installed?"})
    except Exception as e:
        issues.append({"tool": "pylint", "error": f"Execution failed: {e}"})

    # ---- flake8 ----
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "flake8", tmp_file,
             "--format=%(row)d:%(col)d: %(code)s %(text)s"],
            capture_output=True, text=True, timeout=10, encoding='utf-8'
        )
        for line in (proc.stdout + proc.stderr).splitlines():
            m = FLAKE8_RE.match(line.strip())
            if m:
                ln, col, cid, msg = m.groups()
                issues.append({
                    "tool": "flake8",
                    "line": int(ln),
                    "column": int(col),
                    "code": cid,
                    "severity": "style", # Flake8 is mostly style/convention
                    "message": msg
                })
    except FileNotFoundError:
        issues.append({"tool": "flake8", "error": "flake8 not found. Is it installed?"})
    except Exception as e:
        issues.append({"tool": "flake8", "error": f"Execution failed: {e}"})

    return issues


# -------------------------------------------------------
# ✅ Language Auto-Detection (Multilingual)
# -------------------------------------------------------
def detect_language(code: str) -> str:
    """Basic language detection based on common keywords."""
    code_l = code.lower().strip()

    # Check for common keywords
    if "def " in code_l and "import " in code_l:
        return "python"
    if "#include" in code_l and ("std::" in code_l or "cout" in code_l):
        return "cpp"
    if "public static void main" in code_l and "system.out.println" in code_l:
        return "java"
    if ("function " in code_l or "console.log" in code_l or "=>" in code_l) and "<!doctype" not in code_l:
        return "javascript"
    if "<?php" in code_l:
        return "php"
    if "fn main()" in code_l and "println!" in code_l:
        return "rust"
    if "package main" in code_l and "fmt.println" in code_l:
        return "go"
    if "<!doctype html>" in code_l or "</div>" in code_l:
        return "html"
    if "{" in code_l and "}" in code_l and ":" in code_l and "color" in code_l:
        return "css"

    # Default fallback
    return "javascript"


# -------------------------------------------------------
# ✅ Gemini Style Review (Multilingual)
# -------------------------------------------------------
def gemini_style_review(code: str, lang: str):

    if not GEMINI_READY:
        return {
            "ai_used": False,
            "issues": [],
            "summary": "Gemini review skipped: API key not configured or library not found."
        }

    # System instruction to guide the model's behavior
    system_instruction = f"""
You are a senior code reviewer and a programming language expert with over 10 years of experience.
Your task is to analyze the provided {lang} code snippet for STYLE, READABILITY, NAMING CONVENTIONS, and language-specific BEST PRACTICES.
DO NOT analyze logical errors or runtime correctness. Focus only on code quality and maintainability.

You MUST return your analysis in a strict JSON format. Do not add any text before or after the JSON object.

The JSON structure MUST be:
{{
  "issues": [
    {{
      "line": <line_number_integer>,
      "category": "formatting|naming|readability|best_practices|dead_code",
      "message": "<Concise, helpful message about the issue>"
    }}
  ],
  "summary": "<A 1-2 sentence overall summary of the code style.>"
}}

If there are no issues, return an empty "issues" list.
"""

    # User prompt containing the code
    user_prompt = f"""
Analyze this {lang} code:

```{lang}
{code}
```
"""

    try:
        model = genai.GenerativeModel(
            MODEL_NAME,
            system_instruction=system_instruction
        )
        cfg = genai.GenerationConfig(response_mime_type="application/json")

        resp = model.generate_content(user_prompt, generation_config=cfg)
        
        # The response text should be the JSON string
        parsed = json.loads(resp.text)

        return {
            "ai_used": True,
            "issues": parsed.get("issues", []),
            "summary": parsed.get("summary", "AI analysis complete.")
        }

    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        try:
            # Attempt to get more detail if it's a generation error
            print(f"Gemini response details: {resp.prompt_feedback}")
        except:
            pass
        return {
            "ai_used": True, # Attempt was made
            "issues": [],
            "summary": f"Gemini Error: Could not parse AI response. {e}"
        }

# -------------------------------------------------------
# ✅ Main Endpoint
# -------------------------------------------------------
@app.post("/analyze/style")
async def analyze_style(payload: StyleInput):
    
    code = payload.code.strip()
    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "No code provided for analysis."}
        )

    language = (payload.language or detect_language(code)).lower()

    # ----------------------------
    # ✅ Local lint only for Python
    # ----------------------------
    local_issues = []
    tmp_file = None

    if language == "python":
        try:
            # Create a temporary file to run linters against
            with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as f:
                f.write(code)
                tmp_file = f.name
            
            if tmp_file:
                local_issues = local_python_lint(tmp_file)
        
        except Exception as e:
            local_issues = [{"tool": "system", "error": f"Failed to create temp file: {e}"}]
        finally:
            # Clean up the temporary file
            if tmp_file and os.path.exists(tmp_file):
                os.remove(tmp_file)
    else:
        local_issues = [] # No local linter for other languages in this service

    # ----------------------------
    # ✅ Gemini Review (Any Language)
    # ----------------------------
    ai_review = gemini_style_review(code, language)

    # ----------------------------
    # ✅ Combine Results
    # ----------------------------
    total_local_issues = len([i for i in local_issues if "error" not in i])
    total_ai_issues = len(ai_review.get("issues", []))

    return {
        "language_detected": language,
        "ai_model": MODEL_NAME if GEMINI_READY else None,
        "review_summary": {
            "local_issues_found": total_local_issues,
            "ai_issues_found": total_ai_issues,
            "ai_feedback": ai_review.get("summary", "N/A"),
            "note": "Hybrid multilingual style review complete."
        },
        "local_issues": local_issues,
        "ai_review": ai_review,
    }

# -------------------------------------------------------
# ✅ Health Check
# -------------------------------------------------------
@app.get("/")
def home():
    return {
        "service": "Style Service v3",
        "status": "online",
        "multilingual_support": True,
        "gemini_ready": GEMINI_READY,
        "model": MODEL_NAME if GEMINI_READY else None
    }