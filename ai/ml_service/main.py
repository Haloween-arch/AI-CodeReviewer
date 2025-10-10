from fastapi import FastAPI, Request
from pydantic import BaseModel
import ast

app = FastAPI(title="ML Code Suggestion Service")

class CodeRequest(BaseModel):
    code: str

@app.post("/analyze/ml")
async def analyze_ml(req: CodeRequest):
    code = req.code
    
    # --- Dummy "ML-like" logic (replace with real model later) ---
    suggestions = []
    try:
        tree = ast.parse(code)
        # Example heuristic rules
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                if len(node.body) > 10:
                    suggestions.append(
                        f"Function '{node.name}' seems too long. Consider refactoring."
                    )
                if not node.name.islower():
                    suggestions.append(
                        f"Function name '{node.name}' should be snake_case."
                    )
    except SyntaxError as e:
        return {"error": f"Invalid Python code: {e}"}

    if not suggestions:
        suggestions.append("Code looks clean. ✅")

    return {"suggestions": suggestions}
