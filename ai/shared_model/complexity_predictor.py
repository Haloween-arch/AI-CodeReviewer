import os
import re
import json
import torch
import concurrent.futures
from transformers import AutoTokenizer, AutoModelForCausalLM

# ============================================================
#  🔧 CONFIGURATION
# ============================================================

CACHE_DIR = os.path.expanduser("~/.ai_models_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

MODEL_PREFERENCE = [
    "deepseek-ai/deepseek-coder-1.3b-instruct",
    "bigcode/starcoder2-1b"
]

MODEL_NAME = None
model = None
tokenizer = None


def load_local_model():
    """Loads the first available local model."""
    global MODEL_NAME, model, tokenizer
    for candidate in MODEL_PREFERENCE:
        try:
            print(f"🔹 Attempting to load model: {candidate}")
            tokenizer = AutoTokenizer.from_pretrained(candidate, cache_dir=CACHE_DIR)
            model = AutoModelForCausalLM.from_pretrained(
                candidate,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True,
                cache_dir=CACHE_DIR
            ).to("cpu")
            MODEL_NAME = candidate
            print(f"✅ Model loaded successfully: {candidate}\n")
            return
        except Exception as e:
            print(f"⚠️ Failed to load {candidate}: {e}")
    print("❌ No model could be loaded. Using heuristic fallback only.")


load_local_model()

# ============================================================
#  🧮 HEURISTIC (STATIC) ANALYZER
# ============================================================

def heuristic_analysis(code: str, language: str):
    """
    Pattern-based static estimation for complexity.
    More refined version with nested loops, recursion & log checks.
    """
    loops = len(re.findall(r"\b(for|while)\b", code))
    recursions = len(re.findall(r"\bdef\s+(\w+)\s*\([^)]*\):[\s\S]*?\1\s*\(", code)) if language == "python" else 0
    divides = len(re.findall(r"n\s*//|n\s*/\s*2|n\s*>>", code))  # detect divide/log pattern
    array_ops = len(re.findall(r"\[.*?\]", code))
    conds = len(re.findall(r"\bif\b", code))

    # Heuristic estimation rules
    if recursions > 0:
        if divides > 0:
            time_complexity = "O(log n)"
            space_complexity = "O(log n)"
        else:
            time_complexity = "O(2^n)"
            space_complexity = "O(n)"
    elif loops == 0 and divides > 0:
        time_complexity = "O(log n)"
        space_complexity = "O(1)"
    elif loops == 1:
        time_complexity = "O(n)"
        space_complexity = "O(1)"
    elif loops == 2:
        time_complexity = "O(n^2)"
        space_complexity = "O(n)"
    elif loops >= 3:
        time_complexity = "O(n^3)"
        space_complexity = "O(n)"
    else:
        time_complexity = "O(1)"
        space_complexity = "O(1)"

    reasoning = (
        f"Heuristic reasoning: {loops} loop(s), {recursions} recursion(s), "
        f"{divides} divide/log patterns, {array_ops} array operations, {conds} conditions. "
        f"Language: {language.capitalize()}."
    )

    return {
        "time_complexity": time_complexity,
        "space_complexity": space_complexity,
        "reasoning": reasoning
    }


# ============================================================
#  🧠 LOCAL LLM ANALYZER (DeepSeek / StarCoder2)
# ============================================================

def _run_model_analysis(code: str, language: str, verbose: bool = False):
    """
    Private helper for threaded model inference.
    """
    if len(code) > 4000:
        print("⚠️ Code too long, switching to heuristic.")
        return heuristic_analysis(code, language)

    prompt = f"""
You are an expert software engineer. Analyze this {language} code and output ONLY valid JSON like:
{{
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "reasoning": "1–3 short sentences"
}}

Code:
```{language}
{code}
```
Return only JSON, no extra text.
"""


    try:
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True).to("cpu")
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            temperature=0.3,
            do_sample=False
        )
        text = tokenizer.decode(outputs[0], skip_special_tokens=True).strip()

        if verbose:
            print("\n🧠 Model raw output:\n", text)

        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                ai_data = json.loads(match.group(0))
            except json.JSONDecodeError:
                ai_data = {"reasoning": f"Invalid JSON: {text[:200]}"}
        else:
            ai_data = {"reasoning": text[:200] or "No structured output"}

        return {
            "time_complexity": ai_data.get("time_complexity", "O(?)"),
            "space_complexity": ai_data.get("space_complexity", "O(?)"),
            "reasoning": ai_data.get("reasoning", "No reasoning provided."),
        }

    except Exception as e:
        print(f"[⚠️ Local model error: {e}] Falling back to heuristic.")
        return heuristic_analysis(code, language)


# ============================================================
#  🧩 TEST HOOK (Run standalone)
# ============================================================

if __name__ == "__main__":
    sample_code = """
def print_all_pairs(items):
    n = len(items)
    for i in range(n):
        for j in range(n):
            print(items[i], items[j])
"""
    result = analyze_complexity(sample_code, "python", verbose=True)
    print("\n🔍 Final Analysis:")
    print(json.dumps(result, indent=2))