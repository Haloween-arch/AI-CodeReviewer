# ai/report_service/main.py
from fastapi import FastAPI, Request
import httpx, asyncio, os

app = FastAPI(title="Report Service (Level-1 Aggregator)")

# ---------------------------------------------------------------------
# Microservice base URLs
# ---------------------------------------------------------------------
SERVICE_URLS = {
    "style": os.getenv("STYLE_SERVICE", "http://127.0.0.1:8001"),
    "syntax": os.getenv("SYNTAX_SERVICE", "http://127.0.0.1:8002"),
    "security": os.getenv("SECURITY_SERVICE", "http://127.0.0.1:8003"),
    "quality": os.getenv("QUALITY_SERVICE", "http://127.0.0.1:8004"),
    "rule": os.getenv("RULE_SERVICE", "http://127.0.0.1:8006"),
}

# ---------------------------------------------------------------------
# Main endpoint: combine all analyzer outputs into a unified report
# ---------------------------------------------------------------------
@app.post("/report/generate")
async def generate_report(request: Request):
    """
    Accepts JSON: { "code": "<source_code>", "language": "python" }
    Returns: a combined report from all analysis microservices.
    """
    body = await request.json()
    code = body.get("code", "")
    language = body.get("language", "python")

    # Basic validation
    if not isinstance(code, str) or not code.strip():
        return {"error": "No valid code provided"}

    results = {}

    # Async fan-out to all services
    async with httpx.AsyncClient(timeout=20) as client:
        tasks = {
            key: client.post(f"{base}/analyze/{key}", json={"language": language, "code": code})
            for key, base in SERVICE_URLS.items()
        }

        responses = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Collect responses
    for i, key in enumerate(tasks.keys()):
        r = responses[i]
        if isinstance(r, Exception):
            results[key] = {"error": f"Service request failed: {r}"}
        else:
            try:
                data = r.json()
                # Normalize empty or malformed responses
                if not isinstance(data, dict):
                    results[key] = {"error": "Invalid JSON format"}
                elif "error" not in data:
                    data["error"] = None
                    results[key] = data
                else:
                    results[key] = data
            except Exception:
                results[key] = {"error": f"Non-JSON response: {r.text[:200]}"}

    # Build final aggregated report
    return {
        "report": results,
        "summary": {
            "analyzed_services": list(SERVICE_URLS.keys()),
            "successful": [k for k, v in results.items() if not v.get("error")],
            "failed": [k for k, v in results.items() if v.get("error")],
        },
    }
