# Minimal test function to verify Python runtime works on Vercel
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/test")
async def test():
    return {"status": "ok", "message": "Python runtime working"}

@app.post("/api/test")
async def test_post():
    return {"status": "ok", "message": "POST working"}
