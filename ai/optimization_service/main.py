# ai/optimization_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import tempfile, subprocess, os, re, asyncio

app = FastAPI(title="Optimization Service")
PYLINT_TIMEOUT = 8
pylint_line_re = re.compile(r"^.+:(\d+):(\d+):\s*([A-Z]\d+):\s*(.+)$")

@app.post("/analyze/optimization")
async def analyze_optimization(request: Request):
    try:
        body = await request.json()
        code = body.get("code","")
        if not isinstance(code, str):
            return JSONResponse({"error":"code must be a string"}, status_code=400)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        proc = await asyncio.create_subprocess_exec(
            "python", "-m", "pylint", tmp_path, "--disable=all", "--enable=W0611,W0101",
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=PYLINT_TIMEOUT)
        except asyncio.TimeoutError:
            proc.kill()
            return JSONResponse({"error":"pylint timeout"}, status_code=504)

        out = (stdout or b"").decode(errors="ignore") + (stderr or b"").decode(errors="ignore")
        issues = []
        for line in out.splitlines():
            m = pylint_line_re.match(line.strip())
            if m:
                line_no, col, code_id, msg = m.groups()
                issues.append({
                    "line": int(line_no),
                    "column": int(col),
                    "code": code_id,
                    "message": msg.strip(),
                    "severity": "info"
                })
        return {"errors": issues}
    except Exception as e:
        return JSONResponse({"error":str(e)}, status_code=500)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
