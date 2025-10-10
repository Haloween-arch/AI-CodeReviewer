# api-gateway/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware  # ✅ Added for CORS support
import httpx
import asyncio

app = FastAPI(title="API Gateway")

# ✅ Add CORS middleware to allow browser preflight OPTIONS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # You can restrict this to ["http://localhost:3000"] etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registered microservices with their endpoints
MICROSERVICES = {
    "syntax": "http://127.0.0.1:8001/analyze/syntax",
    "style": "http://127.0.0.1:8002/analyze/style",
    "security": "http://127.0.0.1:8003/analyze/security",
    "quality": "http://127.0.0.1:8004/analyze/quality",
    "rules": "http://127.0.0.1:8005/analyze/rules",
}

@app.post("/analyze")
async def analyze(request: Request):
    """
    Aggregate analysis results from all services.
    """
    body = await request.json()
    language = body.get("language", "python")
    code = body.get("code", "")

    if not isinstance(code, str) or not code.strip():
        return JSONResponse({"error": "code must be a non-empty string"}, status_code=400)

    async with httpx.AsyncClient(timeout=10) as client:
        tasks = {
            name: client.post(url, json={"language": language, "code": code})
            for name, url in MICROSERVICES.items()
        }

        results = {}
        for name, task in tasks.items():
            try:
                resp = await task
                if resp.status_code == 200:
                    results[name] = resp.json()
                else:
                    results[name] = {"error": f"{resp.status_code} - {resp.text}"}
            except Exception as e:
                results[name] = {"error": str(e)}

    return {"language": language, "results": results}


@app.post("/report/generate")
async def proxy_report(request: Request):
    """
    Forward report generation requests to the Report Service.
    This lets the frontend call /report/generate through the gateway.
    """
    body = await request.json()
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.post("http://127.0.0.1:8006/report/generate", json=body)
            return JSONResponse(resp.json(), status_code=resp.status_code)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
