from datetime import UTC, datetime, timedelta

import jwt

from src.config import Settings


def create_ml_service_token(settings: Settings) -> str:
    # Token de servicio de vida muy corta (segundos) para autenticar la llamada backend -> ML service.
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.ml_service_jwt_expire_seconds)
    payload = {
        "sub": settings.ml_service_jwt_subject,
        "iss": settings.ml_service_jwt_issuer,
        "aud": settings.ml_service_jwt_audience,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        settings.ml_service_jwt_secret_key,
        algorithm=settings.ml_service_jwt_algorithm,
    )
