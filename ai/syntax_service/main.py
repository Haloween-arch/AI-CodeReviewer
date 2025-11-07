from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import ast, os, re, sys, tempfile, subprocess, shutil, json
from dotenv import load_dotenv

# -------------------------------------------------------
# ✅ Gemini Setup (Optional Hybrid AI Mode)
# -------------------------------------------------------
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_READY = False
# Using gemini-2.0-flash as per the latest model updates
MODEL_NAME = "gemini-2.0-flash" 

try:
    import google.generativeai as genai
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)
        GEMINI_READY = True
        print(f"✅ Gemini ready for Syntax Service using {MODEL_NAME}")
    else:
        print("⚠ Gemini key missing. Only local checks will be used.")

except ImportError:
    print("⚠ 'google.generativeai' not installed. AI review will be disabled.")
except Exception as e:
    print(f"⚠ Gemini init failed: {e}")
    GEMINI_READY = False


# -------------------------------------------------------
# ✅ FastAPI Init
# -------------------------------------------------------
app = FastAPI(title="Syntax Service v3 (Hybrid Local + Gemini)")


# -------------------------------------------------------
# ✅ Request Model
# -------------------------------------------------------
class SyntaxInput(BaseModel):
    code: str
    language: str | None = None


# -------------------------------------------------------
# ✅ Language Detection
# -------------------------------------------------------
def detect_language(code: str):
    """Simple language detection based on common keywords."""
    s = code.strip()

    if "def " in s or s.startswith("import ") or "from " in s:
        return "python"
    if "#include" in s or "::" in s or "std::" in s:
        return "cpp"
    if "public static void main" in s or "System.out.println" in s:
        return "java"
    if re.search(r"(function|const|let|var|=>|console\.log)", s):
        return "javascript"
    
    # Default to python if no strong indicators
    return "python"


# =======================================================
# ✅ PYTHON LOCAL CHECK (ast)
# =======================================================
def check_python(code: str):
    """Validates Python code syntax using the built-in 'ast' module."""
    try:
        ast.parse(code)
        return {"valid": True, "errors": []}
    except SyntaxError as e:
        return {
            "valid": False,
            "errors": [{
                "line": e.lineno or 1,
                "column": e.offset or 1,
                "message": e.msg,
                "snippet": (e.text or "").strip()
            }]
        }


# =======================================================
# ✅ JAVASCRIPT LOCAL CHECK (Node + Esprima)
# =======================================================
ESPRIMA_RUNNER = r"""
// This script is executed by Node.js to check JS syntax
const esprima = require('esprima');
const fs = require('fs');
const codePath = process.argv[2];

if (!codePath) {
    console.log(JSON.stringify({ valid: false, errors: [{ message: "No code file provided to esprima runner." }] }));
    process.exit(1);
}

const code = fs.readFileSync(codePath, 'utf8');
try {
    esprima.parseScript(code, { tolerant: true, loc: true });
    console.log(JSON.stringify({valid:true, errors:[]})); 
} catch(e) {
    console.log(JSON.stringify({
        valid: false,
        errors: [{
            line: e.lineNumber || 1,
            column: e.column || e.index || 0,
            message: e.description || String(e)
        }]
    }));
}
"""

def ensure_esprima(tmpdir: str):
    """Checks for node and installs esprima in the tmpdir if not present."""
    if not shutil.which("node"):
        print("Node.js not found in PATH. Skipping esprima check.")
        return False
    
    esprima_path = os.path.join(tmpdir, "node_modules", "esprima")
    if os.path.exists(esprima_path):
        return True

    # Create package.json to manage dependencies
    pkg_json_path = os.path.join(tmpdir, "package.json")
    if not os.path.exists(pkg_json_path):
        with open(pkg_json_path, "w") as f:
            f.write('{"type": "commonjs"}')

    print("Esprima not found. Installing in temp directory...")
    result = subprocess.run(
        ["npm", "install", "esprima"], 
        cwd=tmpdir,
        timeout=40, 
        capture_output=True, 
        text=True
    )
    if result.returncode != 0:
        print(f"Failed to install esprima: {result.stderr}")
        return False
    
    print("Esprima installed successfully.")
    return True


def check_javascript(code: str):
    """Validates JavaScript code using Node.js and the 'esprima' library."""
    tmp = tempfile.mkdtemp(prefix="jscheck_")
    src = os.path.join(tmp, "code.js")
    runfile = os.path.join(tmp, "run.js")

    try:
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)
        with open(runfile, "w", encoding="utf-8") as f:
            f.write(ESPRIMA_RUNNER)

        if not ensure_esprima(tmp):
            return {"valid": None, "errors": [], "note": "Node.js or esprima unavailable"}

        p = subprocess.run(
            ["node", "run.js", "code.js"],
            cwd=tmp, 
            capture_output=True, 
            text=True, 
            timeout=10
        )

        try:
            return json.loads(p.stdout)
        except json.JSONDecodeError:
            return {"valid": None, "errors": [], "note": f"Node.js error: {p.stderr or p.stdout}"[:200]}

    except Exception as e:
        return {"valid": None, "errors": [], "note": f"JS check failed: {e}"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# =======================================================
# ✅ JAVA LOCAL CHECK (javac)
# =======================================================
JAVA_RE = re.compile(r".*\.java:(\d+):\s*(error|warning):\s*(.*)$")

def check_java(code: str):
    """Validates Java code syntax using 'javac'."""
    if not shutil.which("javac"):
        return {"valid": None, "errors": [], "note": "'javac' not found in PATH."}

    tmp = tempfile.mkdtemp(prefix="javacheck_")
    # Try to find a class name, default to Main
    class_name_match = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", code)
    class_name = class_name_match.group(1) if class_name_match else "Main"
    
    src = os.path.join(tmp, f"{class_name}.java")

    try:
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)

        p = subprocess.run(
            ["javac", "-Xlint", f"{class_name}.java"],
            cwd=tmp, 
            capture_output=True, 
            text=True, 
            timeout=15
        )

        if p.returncode == 0:
            return {"valid": True, "errors": []}

        errors = []
        for line in (p.stdout + p.stderr).splitlines():
            m = JAVA_RE.search(line)
            if m:
                line_no, sev, msg = m.groups()
                errors.append({
                    "line": int(line_no),
                    "column": 1, # javac doesn't always provide column
                    "severity": sev,
                    "message": msg.strip()
                })
        
        if not errors and (p.stdout or p.stderr):
             errors.append({"line": 1, "column": 1, "severity": "error", "message": (p.stdout + p.stderr)[:200]})


        return {"valid": False, "errors": errors}

    except Exception as e:
        return {"valid": None, "errors": [], "note": f"Javac check failed: {e}"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# =======================================================
# ✅ C++ LOCAL CHECK (g++ -fsyntax-only)
# =======================================================
CPP_RE = re.compile(r".*:(\d+):(\d+):\s*(error|warning):\s*(.*)$")

def check_cpp(code: str):
    """Validates C++/C code syntax using 'g++' or 'clang++'."""
    compiler = shutil.which("g++") or shutil.which("clang++")
    if not compiler:
        return {"valid": None, "errors": [], "note": "g++ or clang++ not found in PATH."}

    tmp = tempfile.mkdtemp(prefix="cppcheck_")
    src = os.path.join(tmp, "main.cpp")

    try:
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)

        p = subprocess.run(
            [compiler, "-fsyntax-only", "-std=c++17", "main.cpp"],
            cwd=tmp, 
            capture_output=True, 
            text=True, 
            timeout=15
        )

        if p.returncode == 0:
            return {"valid": True, "errors": []}

        errors = []
        for line in (p.stdout + p.stderr).splitlines():
            m = CPP_RE.search(line)
            if m:
                ln, col, sev, msg = m.groups()
                errors.append({
                    "line": int(ln),
                    "column": int(col),
                    "severity": sev,
                    "message": msg.strip()
                })

        if not errors and (p.stdout or p.stderr):
             errors.append({"line": 1, "column": 1, "severity": "error", "message": (p.stdout + p.stderr)[:200]})

        return {"valid": False, "errors": errors}

    except Exception as e:
        return {"valid": None, "errors": [], "note": f"C++ check failed: {e}"}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# =======================================================
# ✅ GEMINI AI SYNTAX REVIEW (for ANY language)
# =======================================================
def gemini_syntax_review(code: str, lang: str):
    """Validates code syntax using Gemini AI."""
    if not GEMINI_READY:
        return {"ai_used": False, "valid": None, "errors": [], "summary": "Gemini disabled"}

    prompt = f"""
You are an expert compiler and language validator.
Analyze ONLY the SYNTAX of this {lang} code.
Do not comment on style, logic, or best practices.

Return strictly JSON in this exact format:
{{
  "valid": true/false,
  "errors": [
    {{ "line": X, "message": "The specific syntax error." }}
  ],
  "summary": "1–2 sentence explanation of the syntax status."
}}

Code:
```{lang}
{code}
```
"""

    try:
        model = genai.GenerativeModel(MODEL_NAME)
        cfg = genai.GenerationConfig(response_mime_type="application/json")
        resp = model.generate_content(prompt, generation_config=cfg)

        parsed = json.loads(resp.text)

        return {
            "ai_used": True,
            "valid": parsed.get("valid"),
            "errors": parsed.get("errors", []),
            "summary": parsed.get("summary", "")
        }

    except Exception as e:
        return {"ai_used": True, "valid": None, "errors": [], "summary": f"Gemini error: {e}"}

# =======================================================
# ✅ API ROUTE
# =======================================================
@app.post("/analyze/syntax")
async def analyze_syntax(request: Request):
    try:
        body = await request.json()
        payload = SyntaxInput(**body)

        code = payload.code
        lang = (payload.language or "auto").lower()

        if lang == "auto":
            lang = detect_language(code)

        # -----------------------
        # ✅ Local checks first
        # -----------------------
        if lang == "python":
            local = check_python(code)
        elif lang == "javascript":
            local = check_javascript(code)
        elif lang == "java":
            local = check_java(code)
        elif lang == "cpp":
            local = check_cpp(code)
        else:
            # Language detected but no local checker
            local = {"valid": None, "errors": [], "note": f"No local checker for '{lang}'."}

        # -----------------------
        # ✅ Gemini Hybrid Check
        # -----------------------
        ai = gemini_syntax_review(code, lang)

        return JSONResponse(content={
            "language": lang,
            "local_check": local,
            "ai_check": ai,
            "summary": {
                "local_valid": local.get("valid"), # Use .get for safety
                "ai_valid": ai.get("valid"),     # Use .get for safety
                "note": "Hybrid syntax validation complete."
            }
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Syntax Service Error: {e}"},
            status_code=500
        )

# -------------------------------------------------------
# ✅ Health Check
# -------------------------------------------------------
@app.get("/")
def home():
    return {
        "service": "Syntax Service v3 Hybrid",
        "local_languages": ["python", "javascript", "java", "cpp"],
        "gemini_ready": GEMINI_READY,
        "model": MODEL_NAME if GEMINI_READY else None
    }
