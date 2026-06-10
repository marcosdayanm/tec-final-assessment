from datetime import UTC, datetime, timedelta

import jwt

from src.service_auth import verify_service_token



def create_test_service_token(settings) -> str:
    expires_at = datetime.now(UTC) + timedelta(seconds=60)
    payload = {
        "sub": settings.service_jwt_subject,
        "iss": settings.service_jwt_issuer,
        "aud": settings.service_jwt_audience,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        settings.service_jwt_secret_key,
        algorithm=settings.service_jwt_algorithm,
    )


def test_predict_endpoint_returns_label(client) -> None:
    settings = client.app.state.runtime.settings
    token = create_test_service_token(settings)
    response = client.post(
        "/predict",
        json={"message": "verify your bank account"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == {"label": "smishing"}


def test_predict_endpoint_requires_service_token(client) -> None:
    response = client.post("/predict", json={"message": "verify your bank account"})

    assert response.status_code == 401


def test_verify_service_token_accepts_valid_token(client) -> None:
    settings = client.app.state.runtime.settings
    token = create_test_service_token(settings)

    claims = verify_service_token(token, settings)

    assert claims == {"subject": "itchat-backend-service"}
