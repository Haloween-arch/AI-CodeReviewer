from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import tempfile, subprocess, sys, re, os, shutil

app = FastAPI(title="Style & Best Practices Service")

# Regex for pylint
pylint_line_re = re.compile(r"^.+:(\d+):(\d+):\s*([A-Z]\d+):\s*(.+)$")

# Regex for flake8
flake8_line_re = re.compile(r"^(\d+):(\d+):\s*([A-Z]\d+)\s*(.+)$")


@app.post("/analyze/style")
async def analyze_style(request: Request):
    body = await request.json()
    code = body.get("code", "")
    if not isinstance(code, str):
        return JSONResponse({"error": "code must be a string"}, status_code=400)

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode="w", encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        results = []

        # ---------- Run pylint ----------
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "pylint", tmp_path,
                 "--disable=all", "--enable=C,W,E,R",
                 "--reports=no", "--score=no"],
                capture_output=True, text=True, timeout=10
            )
            out = proc.stdout + proc.stderr
            for line in out.splitlines():
                m = pylint_line_re.match(line.strip())
                if m:
                    line_no, col, code_id, msg = m.groups()
                    severity = "warning" if code_id.startswith(("C", "W")) else "error"
                    results.append({
                        "tool": "pylint",
                        "line": int(line_no),
                        "column": int(col),
                        "code": code_id,
                        "message": msg.strip(),
                        "severity": severity
                    })
        except subprocess.TimeoutExpired:
            results.append({"tool": "pylint", "error": "timeout"})

        # ---------- Run flake8 ----------
        try:
            proc = subprocess.run(
                [sys.executable, "-m", "flake8", tmp_path,
                 "--format=%(row)d:%(col)d: %(code)s %(text)s"],
                capture_output=True, text=True, timeout=10
            )
            out = proc.stdout + proc.stderr
            for line in out.splitlines():
                m = flake8_line_re.match(line.strip())
                if m:
                    line_no, col, code_id, msg = m.groups()
                    results.append({
                        "tool": "flake8",
                        "line": int(line_no),
                        "column": int(col),
                        "code": code_id,
                        "message": msg.strip(),
                        "severity": "style"
                    })
        except subprocess.TimeoutExpired:
            results.append({"tool": "flake8", "error": "timeout"})

        return {"style_issues": results}

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
