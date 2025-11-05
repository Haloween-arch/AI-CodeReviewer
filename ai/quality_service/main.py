from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import traceback

# ✅ Import Gemini-based analyzer
from ai.shared_model.gemini_code_reviewer import analyze_code_with_gemini

# ============================================================
#  🚀 FASTAPI SETUP
# ============================================================

app = FastAPI(
    title="Quality Analysis Service (Gemini Edition)",
    description="Analyzes code quality, time & space complexity using Gemini 2.0 Flash.",
    version="4.0.0"
)

# ============================================================
#  📥 INPUT MODEL
# ============================================================

class CodeInput(BaseModel):
    code: str
    language: Optional[str] = "python"

# ============================================================
#  🩺 HEALTH CHECK
# ============================================================

@app.get("/")
def root():
    return {
        "status": "✅ Quality Service (Gemini) running",
        "model": "gemini-2.0-flash",
        "version": "4.0.0"
    }

# ============================================================
#  🔍 MAIN ANALYSIS ROUTE
# ============================================================

@app.post("/analyze/quality")
def analyze_quality(payload: CodeInput) -> Dict[str, Any]:
    """
    Accepts source code and programming language, then returns:
      - Time & space complexity (from Gemini)
      - Code quality issues & recommendations
      - Short review summary
    """
    try:
        code = payload.code.strip()
        language = payload.language.strip().lower()

        if not code:
            raise HTTPException(status_code=400, detail="Code snippet cannot be empty.")

        # 🔹 Perform Gemini-based analysis
        result = analyze_code_with_gemini(code, language)

        return {
            "status": "success",
            "language": language,
            "model": "gemini-2.0-flash",
            "analysis": {
                "time_complexity": result["time_complexity"],
                "space_complexity": result["space_complexity"],
                "issues": result.get("issues", []),
                "recommendations": result.get("recommendations", []),
                "summary": result.get("summary", "No summary provided.")
            }
        }

    except HTTPException as e:
        raise e

    except Exception as e:
        print(f"[❌ ERROR in Quality Service] {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal Server Error in quality analysis.",
                "exception": str(e)
            }
        )

# ============================================================
#  ▶️ RUN LOCALLY
# ============================================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Quality Service (Gemini) on port 8004 ...")
    uvicorn.run("ai.quality_service.main:app", host="127.0.0.1", port=8004, reload=True)
