import jwt

from src.config import Settings
from src.service_auth import create_ml_service_token


def test_create_ml_service_token_contains_expected_claims() -> None:
    settings = Settings(
        database_url="sqlite+aiosqlite:///ignored.db",
        jwt_secret_key="unused-user-secret",
        jwt_algorithm="HS256",
        jwt_expire_minutes=30,
        ml_service_jwt_secret_key="test-ml-secret-key-with-32-bytes-minimum",
        ml_service_jwt_algorithm="HS256",
        ml_service_jwt_issuer="itchat-backend",
        ml_service_jwt_audience="itchat-ml-service",
        ml_service_jwt_subject="itchat-backend-service",
        ml_service_jwt_expire_seconds=60,
        ml_service_url="http://127.0.0.1:8001",
        ml_service_predict_path="/predict",
        ml_service_timeout_seconds=5.0,
        unclassified_label="unclassified",
        cors_allow_origins=("http://localhost:5173",),
        tls_cert_file=None,
        tls_key_file=None,
        host="127.0.0.1",
        port=8000,
    )

    token = create_ml_service_token(settings)
    claims = jwt.decode(
        token,
        settings.ml_service_jwt_secret_key,
        algorithms=[settings.ml_service_jwt_algorithm],
        audience=settings.ml_service_jwt_audience,
        issuer=settings.ml_service_jwt_issuer,
    )

    assert claims["sub"] == settings.ml_service_jwt_subject
