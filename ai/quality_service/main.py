# ai/quality_service/main.py
from fastapi import FastAPI, Request
import radon.complexity as rc
from radon.metrics import mi_visit

app = FastAPI(title="Quality Service")

@app.post("/analyze/quality")
async def analyze_quality(request: Request):
    body = await request.json()
    code = body.get("code","")
    if not isinstance(code, str):
        return {"error":"code must be a string"}
    try:
        blocks = rc.cc_visit(code)
        funcs = [{"name":b.name,"lineno":b.lineno,"complexity":b.complexity} for b in blocks]
    except Exception as e:
        funcs = [{"error": str(e)}]
    try:
        mi = mi_visit(code, True)
    except Exception:
        mi = None
    return {"functions": funcs, "maintainability_index": mi}
