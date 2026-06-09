from fastapi.testclient import TestClient


def register_user(client: TestClient, username: str, password: str = "supersecure123") -> dict[str, object]:
    response = client.post("/v1/register", json={"username": username, "password": password})
    assert response.status_code == 201
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
