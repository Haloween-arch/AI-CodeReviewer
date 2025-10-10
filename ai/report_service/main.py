# ai/report_service/main.py
from fastapi import FastAPI, Request
import httpx
import os
import asyncio  # ✅ needed

app = FastAPI(title="Report Service")

SERVICE_URLS = {
    "style": os.getenv("STYLE_SERVICE", "http://127.0.0.1:8001"),
    "syntax": os.getenv("SYNTAX_SERVICE", "http://127.0.0.1:8002"),
    "security": os.getenv("SECURITY_SERVICE", "http://127.0.0.1:8003"),
    "quality": os.getenv("QUALITY_SERVICE", "http://127.0.0.1:8005"),
    "rule": os.getenv("RULE_SERVICE", "http://127.0.0.1:8006"),
}


@app.post("/report/generate")
async def generate_report(request: Request):
    body = await request.json()
    code = body.get("code", "")
    language = body.get("language", "python")

    results = {}

    async with httpx.AsyncClient(timeout=15) as client:
        tasks = {
            key: client.post(f"{base}/analyze/{key}", json={"language": language, "code": code})
            for key, base in SERVICE_URLS.items()
        }

        # ✅ await all tasks together
        responses = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # Map responses back to their service key
    for i, key in enumerate(tasks.keys()):
        r = responses[i]
        if isinstance(r, Exception):
            results[key] = {"error": str(r)}
        else:
            try:
                results[key] = r.json()
            except Exception:
                results[key] = {"raw": r.text}

    # ✅ Return JSON summary (could be extended to HTML/PDF later)
    return {"report": results}
