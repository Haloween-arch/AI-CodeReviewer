# ai/history_service/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import os
from pymongo import MongoClient
from datetime import datetime

app = FastAPI(title="History Service")
MONGO = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO)
db = client["codesage"]
submissions = db["submissions"]

@app.post("/history/save")
async def save_history(request: Request):
    body = await request.json()
    record = {
        "user": body.get("user"),
        "language": body.get("language"),
        "code": body.get("code"),
        "analysis": body.get("analysis"),
        "createdAt": datetime.utcnow()
    }
    res = submissions.insert_one(record)
    return {"inserted_id": str(res.inserted_id)}
