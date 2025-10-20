import subprocess
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio

app = FastAPI(title="API Gateway")

# ✅ Enable CORS for browser testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Define microservices and their start commands
ROOT_DIR = Path(__file__).resolve().parents[1]

MICROSERVICES = {
    "syntax": (8002, ["python", "-m", "uvicorn", "ai.syntax_service.main:app", "--port", "8002"]),
    "style": (8001, ["python", "-m", "uvicorn", "ai.style_service.main:app", "--port", "8001"]),
    "security": (8003, ["python", "-m", "uvicorn", "ai.security_service.main:app", "--port", "8003"]),
    "quality": (8005, ["python", "-m", "uvicorn", "ai.quality_service.main:app", "--port", "8005"]),
    "rule": (8006, ["python", "-m", "uvicorn", "ai.rule_engine_service.main:app", "--port", "8006"]),
    "report": (8007, ["python", "-m", "uvicorn", "ai.report_service.main:app", "--port", "8007"]),
}

SERVICE_ENDPOINTS = {
    "syntax": "http://127.0.0.1:8002/analyze/syntax",
    "style": "http://127.0.0.1:8001/analyze/style",
    "security": "http://127.0.0.1:8003/analyze/security",
    "quality": "http://127.0.0.1:8005/analyze/quality",
    "rule": "http://127.0.0.1:8006/analyze/rule",
    "report": "http://127.0.0.1:8007/report/generate"
}

running_processes = {}


def start_microservices():
    """Start all microservices from the project root directory"""
    for name, (port, cmd) in MICROSERVICES.items():
        try:
            print(f"🚀 Starting {name} service on port {port} ...")
            proc = subprocess.Popen(cmd, cwd=str(ROOT_DIR))
            running_processes[name] = proc
            time.sleep(1)  # small delay to let the service boot up
        except Exception as e:
            print(f"❌ Failed to start {name} service: {e}")
    print("✅ All microservices started (or attempted).\n")


@app.on_event("startup")
def launch_services():
    start_microservices()


@app.post("/analyze")
async def analyze(request: Request):
    """Aggregate analysis results from syntax/style/security/quality/rule services"""
    body = await request.json()
    language = body.get("language", "python")
    code = body.get("code", "")

    if not isinstance(code, str) or not code.strip():
        return JSONResponse({"error": "code must be a non-empty string"}, status_code=400)

    async with httpx.AsyncClient(timeout=10) as client:
        tasks = {
            name: client.post(url, json={"language": language, "code": code})
            for name, url in SERVICE_ENDPOINTS.items()
            if name != "report"  # exclude report service here
        }

        results = {}
        for name, task in tasks.items():
            try:
                resp = await task
                results[name] = resp.json() if resp.status_code == 200 else {"error": f"{resp.status_code} - {resp.text}"}
            except Exception as e:
                results[name] = {"error": str(e)}

    return {"language": language, "results": results}


@app.post("/report/generate")
async def proxy_report(request: Request):
    """Forward to report service through gateway"""
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(SERVICE_ENDPOINTS["report"], json=body)
            return JSONResponse(resp.json(), status_code=resp.status_code)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
