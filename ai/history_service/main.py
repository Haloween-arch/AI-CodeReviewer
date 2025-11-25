from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os

app = FastAPI(title="History Service")

# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# MongoDB Connection
# ---------------------------------------------------------
MONGO_URI = "mongodb+srv://hitanshuyadav2022_db_user:xlSJbYE1IEKLsmZp@ai.mpaip4e.mongodb.net/?retryWrites=true&w=majority"

client = AsyncIOMotorClient(MONGO_URI)
db = client["codesage"]
history_collection = db["analysis_history"]

# ---------------------------------------------------------
# SAVE HISTORY
# ---------------------------------------------------------
@app.post("/history/save")
async def save_history(request: Request):
    try:
        data = await request.json()
        data["timestamp"] = datetime.utcnow()

        result = await history_collection.insert_one(data)

        return {"status": "saved", "id": str(result.inserted_id)}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ---------------------------------------------------------
# GET LATEST N
# ---------------------------------------------------------
@app.get("/history/latest")
async def get_latest(limit: int = 5):
    try:
        cursor = history_collection.find().sort("timestamp", -1).limit(limit)
        items = await cursor.to_list(length=limit)
        return {"count": len(items), "items": items}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# ---------------------------------------------------------
# GET ALL
# ---------------------------------------------------------
@app.get("/history/all")
async def get_all():
    try:
        cursor = history_collection.find().sort("timestamp", -1)
        items = await cursor.to_list(length=9999)
        return {"count": len(items), "items": items}

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
