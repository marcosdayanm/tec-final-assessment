from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets

import jwt
from fastapi import HTTPException, status

from src.config import Settings


def hash_password(password: str) -> str:
    # PBKDF2-SHA256 con 600k iteraciones y salt aleatorio por usuario; se guarda como salt$digest.
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 600_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored_password_hash: str) -> bool:
    salt, expected_digest = stored_password_hash.split("$", maxsplit=1)
    actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 600_000).hex()
    # compare_digest compara en tiempo constante para no filtrar información por el tiempo de respuesta.
    return hmac.compare_digest(actual_digest, expected_digest)


def create_access_token(user_id: int, username: str, settings: Settings) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "username": username, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict[str, str]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from error

    subject = payload.get("sub")
    username = payload.get("username")
    if not subject or not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )
    return {"user_id": str(subject), "username": str(username)}
