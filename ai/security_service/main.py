# ai/security_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import tempfile, subprocess, sys, os, json

app = FastAPI(title="Security Service")

@app.post("/analyze/security")
async def analyze_security(request: Request):
    body = await request.json()
    code = body.get("code","")
    if not isinstance(code,str):
        return JSONResponse({"error":"code must be a string"}, status_code=400)

    tmp = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as f:
            f.write(code)
            tmp = f.name

        # run bandit on file and produce JSON
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "bandit", "-r", tmp, "-f", "json", "-q"],
                capture_output=True, text=True, timeout=12
            )
            out = proc.stdout or proc.stderr
            try:
                data = json.loads(out) if out.strip() else {"results": []}
            except Exception:
                data = {"raw": out}
            return {"security_issues": data}
        except subprocess.TimeoutExpired:
            return {"security_issues": {"error": "timeout"}}
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)
