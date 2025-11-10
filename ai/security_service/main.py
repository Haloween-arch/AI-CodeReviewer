# ai/security_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import tempfile, subprocess, sys, os, json, re, shutil

from dotenv import load_dotenv

# ============================================================
# 🔧 Gemini (optional) — used only for summary/remediation
# ============================================================
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_READY = False
GEMINI_MODEL = "gemini-2.0-flash"

try:
    if GEMINI_KEY:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        GEMINI_READY = True
        print(f"✅ Gemini enabled for Security Service (model: {GEMINI_MODEL})")
    else:
        print("ℹ️ GEMINI_API_KEY not set — AI summary disabled.")
except Exception as e:
    print(f"⚠️ Gemini init failed: {e}")
    GEMINI_READY = False

# ============================================================
# 🚀 FastAPI
# ============================================================
app = FastAPI(title="Security Service v4 (Hybrid + Multilingual + Gemini)")

# ============================================================
# 📥 Request model
# ============================================================
class SecurityInput(BaseModel):
    code: str
    language: Optional[str] = None  # "python"|"javascript"|"typescript"|"cpp"|"c"|"java"|...

# ============================================================
# 🧭 Helper: choose file extension by language
# ============================================================
def pick_extension(language: str) -> str:
    lang = (language or "").lower().strip()
    if lang in ("python", "py"):
        return ".py"
    if lang in ("javascript", "js"):
        return ".js"
    if lang in ("typescript", "ts"):
        return ".ts"
    if lang in ("c++", "cpp", "cxx"):
        return ".cpp"
    if lang in ("c",):
        return ".c"
    if lang in ("java",):
        return ".java"
    # default: text
    return ".txt"

# ============================================================
# 🧭 Helper: quick language autodetect if not provided
# ============================================================
def detect_language(code: str) -> str:
    s = code.strip()
    if "import " in s or "def " in s or "from " in s:
        return "python"
    if re.search(r"#include\s*<", s):
        return "cpp"
    if re.search(r"\bclass\s+\w+\s*\{", s) and "public static void main" in s:
        return "java"
    if re.search(r"(const|let|var)\s+\w+\s*=", s) or "=>" in s:
        return "javascript"
    return "javascript"  # safe default for semgrep/eslint paths

# ============================================================
# 🛠️ Tool check
# ============================================================
def is_tool_available(cmd: List[str]) -> bool:
    exe = cmd[0]
    # Try to locate executable in PATH (npx, semgrep, cppcheck etc.).
    return shutil.which(exe) is not None

# ============================================================
# 🧪 Local scanners (each optional)
# ============================================================

def run_bandit(py_file: str) -> List[Dict[str, Any]]:
    """Python security: bandit JSON parsing."""
    findings = []
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "bandit", "-r", py_file, "-f", "json", "-q"],
            capture_output=True, text=True, timeout=20
        )
        out = proc.stdout or proc.stderr
        data = json.loads(out) if out.strip() else {"results": []}
        for r in data.get("results", []):
            findings.append({
                "tool": "bandit",
                "file": r.get("filename"),
                "line": r.get("line_number"),
                "severity": (r.get("issue_severity") or "LOW").lower(),
                "confidence": (r.get("issue_confidence") or "LOW").lower(),
                "rule_id": r.get("test_id"),
                "title": r.get("test_name"),
                "message": r.get("issue_text"),
                "cwe": (r.get("issue_cwe") or {}).get("id"),
                "more_info": r.get("more_info")
            })
    except FileNotFoundError:
        findings.append({"tool": "bandit", "error": "bandit not installed"})
    except subprocess.TimeoutExpired:
        findings.append({"tool": "bandit", "error": "timeout"})
    except Exception as e:
        findings.append({"tool": "bandit", "error": str(e)})
    return findings

def run_eslint(js_ts_file: str) -> List[Dict[str, Any]]:
    """JS/TS: ESLint JSON parsing via npx eslint."""
    findings = []
    try:
        if not is_tool_available(["npx"]):
            return [{"tool": "eslint", "error": "npx not available (install Node.js)"}]
        proc = subprocess.run(
            ["npx", "--yes", "eslint", js_ts_file, "-f", "json"],
            capture_output=True, text=True, timeout=30
        )
        # ESLint prints JSON to stdout; if no issues, it may still produce []
        out = proc.stdout or "[]"
        data = json.loads(out)
        for file_block in data:
            file_path = file_block.get("filePath")
            for m in file_block.get("messages", []):
                rule_id = m.get("ruleId")
                severity_num = m.get("severity", 1)  # 1=warn, 2=error
                severity = "high" if severity_num == 2 else "medium"
                findings.append({
                    "tool": "eslint",
                    "file": file_path,
                    "line": m.get("line"),
                    "severity": severity,
                    "rule_id": rule_id,
                    "title": f"ESLint {rule_id}" if rule_id else "ESLint finding",
                    "message": m.get("message"),
                    "cwe": None,
                    "more_info": None
                })
    except subprocess.TimeoutExpired:
        findings.append({"tool": "eslint", "error": "timeout"})
    except Exception as e:
        findings.append({"tool": "eslint", "error": str(e)})
    return findings

def run_cppcheck(c_file: str) -> List[Dict[str, Any]]:
    """C/C++: cppcheck (XML) parsing."""
    findings = []
    try:
        if not is_tool_available(["cppcheck"]):
            return [{"tool": "cppcheck", "error": "cppcheck not installed"}]
        # cppcheck writes XML to stderr by default unless --xml-version is set; we'll use --xml and parse stderr.
        proc = subprocess.run(
            ["cppcheck", "--enable=all", "--xml", c_file],
            capture_output=True, text=True, timeout=30
        )
        xml = proc.stderr  # diagnostics go to stderr with --xml
        # Very light XML parse via regex (to avoid XML deps). Good enough for basic fields.
        # <error id="id" severity="warning" msg="message" verbose="...">
        #   <location file="..." line="..."/>
        # </error>
        error_re = re.compile(r'<error[^>]*id="([^"]+)"[^>]*severity="([^"]+)"[^>]*msg="([^"]+)"[^>]*>')
        loc_re = re.compile(r'<location[^>]*file="([^"]+)"[^>]*line="([^"]+)"')
        for err_match in error_re.finditer(xml):
            rule_id, sev, msg = err_match.groups()
            # grab next location after this error (best-effort)
            loc_match = loc_re.search(xml, err_match.end())
            fpath, line = (None, None)
            if loc_match:
                fpath, line = loc_match.groups()
            findings.append({
                "tool": "cppcheck",
                "file": fpath,
                "line": int(line) if line and line.isdigit() else None,
                "severity": sev.lower(),
                "rule_id": rule_id,
                "title": f"cppcheck {rule_id}",
                "message": msg,
                "cwe": None,
                "more_info": None
            })
    except subprocess.TimeoutExpired:
        findings.append({"tool": "cppcheck", "error": "timeout"})
    except Exception as e:
        findings.append({"tool": "cppcheck", "error": str(e)})
    return findings

def run_semgrep(file_path: str, language: str) -> List[Dict[str, Any]]:
    """Generic multi-language scan using semgrep (if installed)."""
    findings = []
    try:
        if not is_tool_available(["semgrep"]):
            return [{"tool": "semgrep", "error": "semgrep not installed"}]
        proc = subprocess.run(
            ["semgrep", "--config", "p/ci", "-q", "--json", file_path],
            capture_output=True, text=True, timeout=45
        )
        out = proc.stdout or "{}"
        data = json.loads(out)
        for r in data.get("results", []):
            extra = r.get("extra", {})
            sev = (extra.get("severity") or "LOW").lower()
            meta = extra.get("metadata") or {}
            cwe = None
            if isinstance(meta.get("cwe"), list) and meta["cwe"]:
                cwe = meta["cwe"][0]
            findings.append({
                "tool": "semgrep",
                "file": r.get("path"),
                "line": r.get("start", {}).get("line"),
                "severity": sev,
                "rule_id": r.get("check_id"),
                "title": extra.get("message") or r.get("check_id"),
                "message": extra.get("message") or "",
                "cwe": cwe,
                "more_info": meta.get("references", [None])[0] if isinstance(meta.get("references"), list) else None
            })
    except subprocess.TimeoutExpired:
        findings.append({"tool": "semgrep", "error": "timeout"})
    except Exception as e:
        findings.append({"tool": "semgrep", "error": str(e)})
    return findings

# ============================================================
# 🧮 Scoring
# ============================================================

SEVERITY_WEIGHTS = {
    "critical": 5.0,
    "high": 4.0,
    "medium": 3.0,
    "moderate": 3.0,
    "warning": 2.0,
    "low": 1.0,
    "info": 0.5,
    "informational": 0.5,
}

def normalize_severity(raw: Optional[str]) -> str:
    if not raw:
        return "low"
    s = str(raw).lower()
    if s in SEVERITY_WEIGHTS:
        return s
    # bandit uses 'low|medium|high'
    if s.startswith("crit"):
        return "critical"
    if s.startswith("hi"):
        return "high"
    if s.startswith("med") or s.startswith("mod"):
        return "medium"
    if s.startswith("warn"):
        return "warning"
    if s.startswith("inf"):
        return "info"
    if s.startswith("low"):
        return "low"
    return "low"

def compute_score(findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Score 0..100 (higher is better). Smoothly penalize many/critical findings.
    Formula: score = 100 - 100 * R / (R + K), R=sum(weights), K=20 (tunable).
    """
    K = 20.0
    severity_counts = {k: 0 for k in ["critical", "high", "medium", "warning", "low", "info"]}
    tool_counts: Dict[str, int] = {}
    rule_counts: Dict[str, int] = {}

    risk_sum = 0.0
    for f in findings:
        sev = normalize_severity(f.get("severity"))
        w = SEVERITY_WEIGHTS.get(sev, 1.0)
        risk_sum += w
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

        tool = f.get("tool") or "unknown"
        tool_counts[tool] = tool_counts.get(tool, 0) + 1

        rid = f.get("rule_id") or "unknown"
        rule_counts[rid] = rule_counts.get(rid, 0) + 1

    score = 100.0 - 100.0 * (risk_sum / (risk_sum + K))
    score = max(0.0, min(100.0, score))

    # Top rules for charting
    top_rules = sorted(rule_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_rules = [{"rule_id": r, "count": c} for r, c in top_rules]

    return {
        "overall": round(score, 2),
        "risk_sum": round(risk_sum, 2),
        "by_severity": severity_counts,
        "by_tool": tool_counts,
        "top_rules": top_rules,
        # handy for graphs
        "series": {
            "severity": [{"name": k, "value": v} for k, v in severity_counts.items()],
            "tool": [{"name": k, "value": v} for k, v in tool_counts.items()],
            "rules": top_rules
        }
    }

# ============================================================
# 🤖 Gemini AI summary
# ============================================================
def gemini_security_summary(code: str, language: str, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not GEMINI_READY:
        return {"ai_used": False, "summary": "Gemini disabled.", "top_risks": [], "recommendations": []}

    # Keep payload concise to avoid token waste
    compact_findings = findings[:60]  # cap
    prompt = f"""
You are a senior application security reviewer.

Given the following {language} code and static-scan findings, produce a JSON summary with:
{{
  "summary": "2-4 sentence risk overview",
  "top_risks": [ "short bullet 1", "short bullet 2", "..." ],
  "recommendations": [ "short actionable fix 1", "short actionable fix 2", "..." ]
}}

FINDINGS (JSON array):
{json.dumps(compact_findings, ensure_ascii=False)}

CODE:
```{language}
{code[:12000]}
Return ONLY valid JSON with keys: summary, top_risks, recommendations.
"""
    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        cfg = genai.GenerationConfig(response_mime_type="application/json")
        resp = model.generate_content(prompt, generation_config=cfg)
        text = (resp.text or "").strip()
        data = json.loads(text)
        return {
            "ai_used": True,
            "summary": data.get("summary", ""),
            "top_risks": data.get("top_risks", []),
            "recommendations": data.get("recommendations", [])
        }
    except Exception as e:
        # Fallback loose parse
        try:
            m = re.search(r"\{[\s\S]*\}", text)
            if m:
                data = json.loads(m.group(0))
                return {
                    "ai_used": True,
                    "summary": data.get("summary", ""),
                    "top_risks": data.get("top_risks", []),
                    "recommendations": data.get("recommendations", [])
                }
        except Exception:
            pass
        return {"ai_used": True, "summary": f"Gemini error: {e}", "top_risks": [], "recommendations": []}

# ============================================================
# 🧵 Main endpoint
# ============================================================
@app.post("/analyze/security")
async def analyze_security(request: Request):
    try:
        body = await request.json()
        payload = SecurityInput(**body)

        code = (payload.code or "").strip()
        if not code:
            return JSONResponse({"error": "code must not be empty"}, status_code=400)

        language = (payload.language or "").strip().lower() or detect_language(code)
        ext = pick_extension(language)

        tmp_dir = tempfile.mkdtemp(prefix="secsvc_")
        file_path = os.path.join(tmp_dir, f"snippet{ext}")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)

        findings: List[Dict[str, Any]] = []
        detectors_used: List[str] = []

        # Per-language local scanner(s)
        if language == "python":
            detectors_used.append("bandit")
            findings += run_bandit(file_path)

        elif language in ("javascript", "js", "typescript", "ts"):
            detectors_used.append("eslint")
            findings += run_eslint(file_path)

        elif language in ("c", "cpp", "c++", "cxx"):
            detectors_used.append("cppcheck")
            findings += run_cppcheck(file_path)

        # Semgrep as cross-language add-on (optional)
        detectors_used.append("semgrep")
        findings += run_semgrep(file_path, language)

        # Filter out pure "error" rows (tool missing/timeouts) for scoring
        issues_only = [f for f in findings if "error" not in f]

        score = compute_score(issues_only)

        # Gemini summary (optional)
        ai = gemini_security_summary(code, language, issues_only)

        response = {
            "language": language,
            "detectors_used": detectors_used,
            "findings": findings,            # keep raw list for detail panes
            "score": score,                  # 0..100 + chartable series
            "ai_review": ai,                 # optional AI summary/remediation
        }
        return JSONResponse(response)

    except Exception as e:
        return JSONResponse({"error": f"Security Service Error: {e}"}, status_code=500)
    finally:
        # cleanup temp dir
        try:
            if 'tmp_dir' in locals() and os.path.isdir(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

# ============================================================
# 🩺 Health
# ============================================================
@app.get("/")
def health():
    return {
        "service": "Security Service v4",
        "gemini_ready": GEMINI_READY,
        "model": GEMINI_MODEL if GEMINI_READY else None,
        "tools": {
            "bandit": bool(shutil.which(sys.executable)) and "bandit" in (subprocess.list2cmdline([sys.executable, "-m", "bandit"]) or "bandit"),
            "eslint": bool(shutil.which("npx")),
            "cppcheck": bool(shutil.which("cppcheck")),
            "semgrep": bool(shutil.which("semgrep")),
        }
    }