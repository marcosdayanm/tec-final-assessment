import jwt
from fastapi import HTTPException, status

from src.config import Settings


def verify_service_token(token: str, settings: Settings) -> dict[str, str]:
    try:
        payload = jwt.decode(
            token,
            settings.service_jwt_secret_key,
            algorithms=[settings.service_jwt_algorithm],
            audience=settings.service_jwt_audience,
            issuer=settings.service_jwt_issuer,
        )
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired service token.",
        ) from error

    subject = payload.get("sub")
    if subject != settings.service_jwt_subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token subject.",
        )
    return {"subject": str(subject)}
