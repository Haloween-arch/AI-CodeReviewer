# ai/user_service/main.py
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import os, bcrypt, jwt
from pymongo import MongoClient

app = FastAPI(title="User Service")
MONGO = os.getenv("MONGO_URI", "mongodb+srv://hitanshuyadav2022_db_user:ByeUo6YoeZv639nH@ai.cmv5u0u.mongodb.net/?retryWrites=true&w=majority&appName=ai")
JWT_SECRET = os.getenv("JWT_SECRET","supersecretkey")
client = MongoClient(MONGO)
db = client["codesage"]
users = db["users"]

class RegisterReq(BaseModel):
    email: str
    password: str
    name: str = None

@app.post("/auth/register")
async def register(req: RegisterReq):
    if users.find_one({"email": req.email}):
        raise HTTPException(status_code=400, detail="Email exists")
    pw_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    users.insert_one({"email": req.email, "password": pw_hash, "name": req.name})
    return {"status":"ok"}

@app.post("/auth/login")
async def login(request: Request):
    body = await request.json()
    email = body.get("email")
    password = body.get("password")
    u = users.find_one({"email": email})
    if not u or not bcrypt.checkpw(password.encode(), u["password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = jwt.encode({"sub": str(u["_id"]), "email": u["email"]}, JWT_SECRET, algorithm="HS256")
    return {"token": token}
