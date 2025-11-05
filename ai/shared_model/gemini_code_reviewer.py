import os
import google.generativeai as genai
from dotenv import load_dotenv

# ============================================================
#  🔧 CONFIGURATION
# ============================================================

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("❌ GEMINI_API_KEY not found in .env file!")

genai.configure(api_key=API_KEY)

# ============================================================
#  🧠 MODEL SETUP
# ============================================================

SYSTEM_INSTRUCTION = """
You are a **Senior Code Reviewer (7+ years experience)** specializing in analyzing and improving source code.

### 🧩 Your Role:
You are an expert code reviewer whose job is to:
  • Analyze time & space complexity accurately.
  • Review code quality, maintainability, and efficiency.
  • Suggest improvements for readability, performance, and security.

### 🧮 Complexity Analysis
1. Identify time complexity in Big-O form.
2. Identify space complexity in Big-O form.
3. Explain briefly why those complexities apply.

### 🧑‍💻 Code Review
Provide:
- Key Issues (❌)
- Recommendations (✅)
- Overall Summary (💡)

### 🧠 Tone & Style
Be **precise**, **structured**, and **developer-friendly**.
Balance constructive feedback with encouragement.

### 📦 Output JSON Format
Return your response in this exact structure:

{
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "issues": ["..."],
  "recommendations": ["..."],
  "summary": "..."
}
"""

# ============================================================
#  ⚙️ ANALYSIS FUNCTION
# ============================================================

def analyze_code_with_gemini(code: str, language: str = "python"):
    """
    Uses Gemini 2.0 Flash to analyze code for complexity, performance, and quality.
    Returns structured JSON.
    """
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=SYSTEM_INSTRUCTION
    )

    prompt = f"""
    Analyze the following {language} code as per the system instruction and return valid JSON only.

    ```{language}
    {code}
    ```
    """

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        # Try to extract JSON safely
        import re, json
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                data = {"summary": f"Invalid JSON: {text[:200]}"}  # fallback
        else:
            data = {"summary": text[:200] or "No structured output"}

        # Ensure keys exist
        return {
            "time_complexity": data.get("time_complexity", "O(?)"),
            "space_complexity": data.get("space_complexity", "O(?)"),
            "issues": data.get("issues", []),
            "recommendations": data.get("recommendations", []),
            "summary": data.get("summary", "No summary provided.")
        }

    except Exception as e:
        print(f"[❌ Gemini Analysis Error] {e}")
        return {
            "time_complexity": "O(?)",
            "space_complexity": "O(?)",
            "issues": ["Gemini API failed to analyze code."],
            "recommendations": ["Try again or verify model access."],
            "summary": f"Error: {str(e)}"
        }

# ============================================================
#  🧩 TEST (Run Standalone)
# ============================================================

if __name__ == "__main__":
    sample_code = """
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n - 1)
"""
    print("🔍 Running Gemini Code Review...\n")
    result = analyze_code_with_gemini(sample_code, "python")
    import json
    print(json.dumps(result, indent=2))
