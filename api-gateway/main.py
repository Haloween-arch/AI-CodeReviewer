import subprocess
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="API Gateway")

# ---------------------------------------------------------
#  Enable CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
#  Microservices (including new HISTORY service)
# ---------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parents[1]

MICROSERVICES = {
    "syntax": (8002, ["python", "-m", "uvicorn", "ai.syntax_service.main:app", "--port", "8002"]),
    "style": (8001, ["python", "-m", "uvicorn", "ai.style_service.main:app", "--port", "8001"]),
    "security": (8003, ["python", "-m", "uvicorn", "ai.security_service.main:app", "--port", "8003"]),
    "quality": (8004, ["python", "-m", "uvicorn", "ai.quality_service.main:app", "--port", "8004"]),
    "rule": (8006, ["python", "-m", "uvicorn", "ai.rule_engine_service.main:app", "--port", "8006"]),
    "report": (8007, ["python", "-m", "uvicorn", "ai.report_service.main:app", "--port", "8007"]),
    "history": (8008, ["python", "-m", "uvicorn", "ai.history_service.main:app", "--port", "8008"]),
}

SERVICE_ENDPOINTS = {
    "syntax": "http://127.0.0.1:8002/analyze/syntax",
    "style": "http://127.0.0.1:8001/analyze/style",
    "security": "http://127.0.0.1:8003/analyze/security",
    "quality": "http://127.0.0.1:8004/analyze/quality",
    "rule": "http://127.0.0.1:8006/analyze/rule",
    "report": "http://127.0.0.1:8007/report/generate",
    "history_save": "http://127.0.0.1:8008/history/save",
    "history_latest": "http://127.0.0.1:8008/history/latest",
    "history_all": "http://127.0.0.1:8008/history/all",
}

running_processes = {}

# ---------------------------------------------------------
#  Auto-start microservices
# ---------------------------------------------------------
def start_microservices():
    for name, (port, cmd) in MICROSERVICES.items():
        try:
            print(f"🚀 Starting {name} service on port {port} ...")
            proc = subprocess.Popen(cmd, cwd=str(ROOT_DIR))
            running_processes[name] = proc
            time.sleep(0.8)
        except Exception as e:
            print(f"❌ Failed to start {name}: {e}")
    print("✅ All microservices launched!\n")

@app.on_event("startup")
def launch_services():
    start_microservices()

# ---------------------------------------------------------
#  ANALYZE → Combine results from all services
# ---------------------------------------------------------
@app.post("/analyze")
async def analyze(request: Request):
    body = await request.json()
    language = body.get("language", "python")
    code = body.get("code", "")

    if not code.strip():
        return JSONResponse({"error": "Empty code not allowed"}, status_code=400)

    async with httpx.AsyncClient(timeout=25) as client:
        tasks = {
            name: client.post(url, json={"language": language, "code": code})
            for name, url in SERVICE_ENDPOINTS.items()
            if name not in ("report", "history_save", "history_latest", "history_all")
        }

        results = {}
        for name, task in tasks.items():
            try:
                resp = await task
                results[name] = resp.json()
            except Exception as e:
                results[name] = {"error": str(e)}

    final = {"language": language, "results": results}

    # -----------------------------------------------------
    #  Save analysis to HISTORY SERVICE (MongoDB)
    # -----------------------------------------------------
    # SAVE HISTORY
    async with httpx.AsyncClient(timeout=10) as client2:
     try:
        await client2.post(SERVICE_ENDPOINTS["history_save"], json=final)
     except Exception as e:
        print("⚠ MongoDB Save Failed:", e)


    return final

# ---------------------------------------------------------
#  REPORT GENERATION
# ---------------------------------------------------------
@app.post("/report/generate")
async def proxy_report(request: Request):
    body = await request.json()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(SERVICE_ENDPOINTS["report"], json=body)
            return JSONResponse(resp.json(), status_code=resp.status_code)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)

# ---------------------------------------------------------
#  HISTORY ENDPOINTS (direct from gateway)
# ---------------------------------------------------------
@app.get("/history/latest")
async def get_latest(limit: int = 5):
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{SERVICE_ENDPOINTS['history_latest']}?limit={limit}")
        return resp.json()

@app.get("/history/all")
async def get_all():
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(SERVICE_ENDPOINTS["history_all"])
        return resp.json()
