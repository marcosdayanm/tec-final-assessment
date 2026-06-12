import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_expire_minutes: int
    ml_service_jwt_secret_key: str
    ml_service_jwt_algorithm: str
    ml_service_jwt_issuer: str
    ml_service_jwt_audience: str
    ml_service_jwt_subject: str
    ml_service_jwt_expire_seconds: int
    ml_service_url: str
    ml_service_predict_path: str
    ml_service_timeout_seconds: float
    unclassified_label: str
    cors_allow_origins: tuple[str, ...]
    tls_cert_file: str | None
    tls_key_file: str | None
    host: str
    port: int

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        # Lee la configuración desde variables de entorno (.env) con valores por defecto para desarrollo.
        return cls(
            database_url=os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/chat_app"),
            jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-this-secret-before-production"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "60")),
            ml_service_jwt_secret_key=os.getenv(
                "ML_SERVICE_JWT_SECRET_KEY",
                "change-this-ml-service-secret-before-production",
            ),
            ml_service_jwt_algorithm=os.getenv("ML_SERVICE_JWT_ALGORITHM", "HS256"),
            ml_service_jwt_issuer=os.getenv("ML_SERVICE_JWT_ISSUER", "itchat-backend"),
            ml_service_jwt_audience=os.getenv("ML_SERVICE_JWT_AUDIENCE", "itchat-ml-service"),
            ml_service_jwt_subject=os.getenv("ML_SERVICE_JWT_SUBJECT", "itchat-backend-service"),
            ml_service_jwt_expire_seconds=int(os.getenv("ML_SERVICE_JWT_EXPIRE_SECONDS", "60")),
            ml_service_url=os.getenv("ML_SERVICE_URL", "http://127.0.0.1:8001"),
            ml_service_predict_path=os.getenv("ML_SERVICE_PREDICT_PATH", "/predict"),
            ml_service_timeout_seconds=float(os.getenv("ML_SERVICE_TIMEOUT_SECONDS", "5")),
            unclassified_label=os.getenv("UNCLASSIFIED_LABEL", "unclassified"),
            cors_allow_origins=_split_csv_env(
                os.getenv(
                    "CORS_ALLOW_ORIGINS",
                    "http://localhost:5173,http://127.0.0.1:5173",
                )
            ),
            tls_cert_file=os.getenv("TLS_CERT_FILE"),
            tls_key_file=os.getenv("TLS_KEY_FILE"),
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8000")),
        )


def _split_csv_env(raw_value: str) -> tuple[str, ...]:
    return tuple(value.strip() for value in raw_value.split(",") if value.strip())
