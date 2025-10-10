# ai/syntax_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import ast
from radon.complexity import cc_visit, cc_rank

app = FastAPI(title="Syntax & Complexity Service")

@app.post("/analyze/syntax")
async def analyze_syntax(request: Request):
    body = await request.json()
    code = body.get("code", "")
    if not isinstance(code, str):
        return JSONResponse({"error": "code must be a string"}, status_code=400)

    # Step 1: Syntax Check
    try:
        ast.parse(code)
        syntax_valid = True
        syntax_errors = []
    except SyntaxError as e:
        syntax_valid = False
        syntax_errors = [{
            "line": e.lineno,
            "offset": e.offset,
            "message": e.msg,
            "text": e.text.strip() if e.text else ""
        }]
        return {"valid": syntax_valid, "errors": syntax_errors, "complexity": []}

    # Step 2: Complexity Check (radon API)
    try:
        blocks = cc_visit(code)
        complexity = [
            {
                "name": b.name,
                "lineno": b.lineno,
                "complexity": b.complexity,
                "rank": cc_rank(b.complexity)
            }
            for b in blocks
        ]
    except Exception as e:
        complexity = [{"error": str(e)}]

    return {
        "valid": syntax_valid,
        "errors": syntax_errors,
        "complexity": complexity
    }
