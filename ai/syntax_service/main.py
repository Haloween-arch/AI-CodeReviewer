from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import ast
from radon.complexity import cc_visit, cc_rank
from radon.metrics import mi_visit, h_visit, analyze

app = FastAPI(title="Syntax & Complexity Service")

@app.post("/analyze/syntax")
async def analyze_syntax(request: Request):
    body = await request.json()
    code = body.get("code", "")
    if not isinstance(code, str):
        return JSONResponse({"error": "code must be a string"}, status_code=400)

    syntax_valid = True
    syntax_errors = []
    complexity = []

    # STEP 1: Syntax check
    try:
        ast.parse(code)
    except SyntaxError as e:
        syntax_valid = False
        syntax_errors.append({
            "line": e.lineno,
            "offset": e.offset,
            "message": e.msg,
            "text": e.text.strip() if e.text else ""
        })

    # STEP 2: Complexity check
    if syntax_valid:
        try:
            blocks = cc_visit(code)
            if blocks:
                complexity = [
                    {
                        "name": b.name,
                        "lineno": b.lineno,
                        "complexity": b.complexity,
                        "rank": cc_rank(b.complexity)
                    }
                    for b in blocks
                ]
            else:
                # No functions/classes → provide summary metrics
                metrics = analyze(code)
                complexity = [{
                    "summary": True,
                    "loc": metrics.loc,
                    "lloc": metrics.lloc,
                    "sloc": metrics.sloc,
                    "comments": metrics.comments,
                    "multi": metrics.multi,
                    "blank": metrics.blank,
                    "mi_score": mi_visit(code),
                    "halstead": h_visit(code)._asdict()
                }]
        except Exception as e:
            complexity = [{"error": str(e)}]

    return {
        "valid": syntax_valid,
        "errors": syntax_errors,
        "complexity": complexity
    }
