from tests.helpers import register_user


def test_register_success_returns_token_and_user(client) -> None:
    payload = register_user(client, "alice")

    assert payload["token"]
    assert payload["user"]["username"] == "alice"


def test_register_rejects_duplicate_username(client) -> None:
    register_user(client, "alice")

    response = client.post("/v1/register", json={"username": "alice", "password": "supersecure123"})

    assert response.status_code == 409


def test_login_success(client) -> None:
    register_user(client, "alice")

    response = client.post("/v1/login", json={"username": "alice", "password": "supersecure123"})

    assert response.status_code == 200
    assert response.json()["user"]["username"] == "alice"


def test_login_invalid_credentials(client) -> None:
    register_user(client, "alice")

    response = client.post("/v1/login", json={"username": "alice", "password": "wrongpassword"})

    assert response.status_code == 401
