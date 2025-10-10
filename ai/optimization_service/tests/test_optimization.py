# ai/optimization_service/tests/test_optimization.py
from fastapi.testclient import TestClient
from .. import main

client = TestClient(main.app)

def test_optimization_empty():
    code = "print('ok')"
    resp = client.post("/analyze/optimization", json={"code": code})
    assert resp.status_code == 200
    assert "errors" in resp.json()
