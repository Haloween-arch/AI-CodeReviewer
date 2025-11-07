from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import tempfile, subprocess, sys, os, json, re
from dotenv import load_dotenv

# -------------------------------------------------------
# ✅ Gemini Setup
# -------------------------------------------------------
load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

GEMINI_READY = False
# Note: Using a model that supports JSON output.
MODEL_NAME = "gemini-2.5-flash-preview-09-2025"

try:
    import google.generativeai as genai
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)
        GEMINI_READY = True
        print(f"✅ Gemini ready for Security Service using {MODEL_NAME}")
    else:
        print("⚠ Gemini API key not found. Set GEMINI_API_KEY environment variable.")
except ImportError:
    print("⚠ 'google.generativeai' not installed. AI features will be disabled.")
    GEMINI_READY = False
except Exception as e:
    print(f"⚠ Gemini init failed: {e}")
    GEMINI_READY = False


# -------------------------------------------------------
# ✅ FastAPI Init
# -------------------------------------------------------
app = FastAPI(title="Security Service v3 (Hybrid + Multilingual + Scoring)")


# -------------------------------------------------------
# ✅ Request Model
# -------------------------------------------------------
class SecInput(BaseModel):
    code: str
    language: str | None = None


# -------------------------------------------------------
# ✅ Basic Multilingual Language Detection
# -------------------------------------------------------
def detect_language(code: str):
    """Basic language detection based on common keywords."""
    code_l = code.lower().strip()

    if "def " in code_l and "import " in code_l:
        return "python"
    if "#include" in code_l and ("std::" in code_l or "cout" in code_l):
        return "cpp"
    if "public class" in code_l or "public static void main" in code_l:
        return "java"
    if ("function " in code_l or "console.log" in code_l or "=>" in code_l) and "<!doctype" not in code_l:
        return "javascript"
    if "<?php" in code_l:
        return "php"
    if "use std::" in code_l or "fn main" in code_l:
        return "rust"
    if "package main" in code_l and "fmt.println" in code_l:
        return "go"
    if "class " in code_l and "namespace " in code_l:
        return "csharp"

    # Default fallback
    return "javascript"


# -------------------------------------------------------
# ✅ Local Security Scan (Python Only)
# -------------------------------------------------------
def local_bandit_scan(tmp_file: str):
    """Runs bandit security linter on a Python file."""
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "bandit", "-r", tmp_file, "-f", "json", "-q"],
            capture_output=True, text=True, timeout=10, encoding='utf-8'
        )
        out = proc.stdout or proc.stderr
        # Handle cases where bandit doesn't output valid JSON on no issues
        if not out.strip() or not out.strip().startswith("{"):
             return {"results": [], "errors": []}
        data = json.loads(out)
        return data
    except FileNotFoundError:
        return {"error": "bandit_error: 'bandit' not found. Is it installed?"}
    except json.JSONDecodeError:
         return {"error": "bandit_error: Failed to decode bandit JSON output.", "raw_output": out}
    except Exception as e:
        return {"error": f"bandit_error: {e}"}


# -------------------------------------------------------
# ✅ Gemini AI Security Scan (Multilingual)
# -------------------------------------------------------
def gemini_security_scan(code: str, lang: str):
    """Performs AI-based security analysis using Gemini."""
    if not GEMINI_READY:
        return {
            "ai_used": False,
            "issues": [],
            "score": 50, # Neutral score if AI is disabled
            "summary": "Gemini review skipped: API key not configured or library not found."
        }

    # System instruction to guide the model's behavior
    system_instruction = f"""
You are a senior application security auditor and a programming language expert.
Your task is to analyze ONLY THE SECURITY of this {lang} code.
Identify vulnerabilities and assign a security score.

You MUST return your analysis in a strict JSON format. Do not add any text before or after the JSON object.

The JSON structure MUST be:
{{
  "issues": [
    {{
      "line": <line_number_integer>,
      "severity": "low|medium|high|critical",
      "category": "injection|auth|crypto|validation|dangerous_api|dos|exposure|other",
      "message": "<Concise, helpful explanation of the vulnerability>"
    }}
  ],
  "score": 0-100,  # 100 = very secure, 0 = highly vulnerable
  "summary": "<A 1-2 sentence overall summary of the code's security posture.>"
}}

If there are no issues, return an empty "issues" list and a score of 95-100.
"""

    # User prompt containing the code
    user_prompt = f"""
Analyze this {lang} code for security vulnerabilities:

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
            "score": int(parsed.get("score", 50)), # Default to 50 on missing score
            "summary": parsed.get("summary", "AI analysis complete.")
        }

    except Exception as e:
        print(f"Error during Gemini API call: {e}")
        return {
            "ai_used": True, # Attempt was made
            "issues": [],
            "score": 50, # Neutral score on error
            "summary": f"Gemini Error: Could not parse AI response. {e}"
        }

# -------------------------------------------------------
# ✅ Security Score Merge Logic
# -------------------------------------------------------
def merge_scores(local_score: int | None, ai_score: int):
    """
    If local result exists: average scores.
    If only AI exists: return AI score.
    """
    if local_score is None:
        return ai_score
    return (local_score + ai_score) // 2

def bandit_score(bandit_json):
    """Convert Bandit result into a 0–100 score."""
    if "results" not in bandit_json or "error" in bandit_json:
        return None # No score if bandit failed or had no results

    results = bandit_json.get("results", [])
    if not results:
        return 95 # No issues found

    high = sum(1 for r in results if r.get("issue_severity") == "HIGH")
    med = sum(1 for r in results if r.get("issue_severity") == "MEDIUM")
    low = sum(1 for r in results if r.get("issue_severity") == "LOW")

    # Simple scoring logic, can be refined
    score = 100
    score -= (high * 20) # -20 for each high
    score -= (med * 10)  # -10 for each medium
    score -= (low * 2)   # -2 for each low
    
    return max(0, score) # Ensure score doesn't go below 0

# -------------------------------------------------------
# ✅ Main Endpoint
# -------------------------------------------------------
@app.post("/analyze/security")
async def analyze_security(payload: SecInput):
    
    code = payload.code.strip()
    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "No code provided for analysis."}
        )
        
    language = (payload.language or detect_language(code)).lower()

    # ----------------------------
    # ✅ 1) Local scan (Python only)
    # ----------------------------
    local_data = None
    local_score = None
    tmp_file = None

    if language == "python":
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as f:
                f.write(code)
                tmp_file = f.name
            
            if tmp_file:
                local_data = local_bandit_scan(tmp_file)
                local_score = bandit_score(local_data)
        
        except Exception as e:
            local_data = {"error": f"Failed to create temp file: {e}"}
        finally:
            if tmp_file and os.path.exists(tmp_file):
                os.remove(tmp_file)
    else:
        local_data = {"note": f"No local security scanner for {language}"}

    # ----------------------------
    # ✅ 2) Gemini scan (ANY language)
    # ----------------------------
    ai_data = gemini_security_scan(code, language)

    # ----------------------------
    # ✅ 3) Final Score Merge
    # ----------------------------
    final_score = merge_scores(local_score, ai_data.get("score", 50))

    return {
        "language_detected": language,
        "final_security_score": final_score,
        "summary": f"Security evaluation complete. Final score: {final_score}/100. {ai_data.get('summary', '')}",
        "local_scan_results": {
            "scanner": "bandit" if language == "python" else "N/A",
            "score": local_score,
            "data": local_data
        },
        "ai_scan_results": {
            "scanner": "gemini",
            "model": MODEL_NAME if GEMINI_READY else None,
            "data": ai_data
        }
    }

# -------------------------------------------------------
# ✅ Health Check
# -------------------------------------------------------
@app.get("/")
def home():
    return {
        "service": "Security Service v3",
        "status": "online",
        "multilingual_support": True,
        "gemini_ready": GEMINI_READY,
        "model": MODEL_NAME if GEMINI_READY else None
    }