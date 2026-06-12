import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "sms_linear_svm.pkl"
DEFAULT_DATASET_PATH = DATA_DIR / "dataset.csv"


@dataclass(frozen=True)
class Settings:
    model_path: Path
    dataset_path: Path
    service_jwt_secret_key: str
    service_jwt_algorithm: str
    service_jwt_issuer: str
    service_jwt_audience: str
    service_jwt_subject: str
    host: str
    port: int
    tls_cert_file: str | None
    tls_key_file: str | None

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        # Lee la configuración desde variables de entorno (.env) con valores por defecto.
        return cls(
            model_path=Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser(),
            dataset_path=Path(os.getenv("DATASET_PATH", str(DEFAULT_DATASET_PATH))).expanduser(),
            service_jwt_secret_key=os.getenv(
                "SERVICE_JWT_SECRET_KEY",
                "change-this-ml-service-secret-before-production",
            ),
            service_jwt_algorithm=os.getenv("SERVICE_JWT_ALGORITHM", "HS256"),
            service_jwt_issuer=os.getenv("SERVICE_JWT_ISSUER", "itchat-backend"),
            service_jwt_audience=os.getenv("SERVICE_JWT_AUDIENCE", "itchat-ml-service"),
            service_jwt_subject=os.getenv("SERVICE_JWT_SUBJECT", "itchat-backend-service"),
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", "8001")),
            tls_cert_file=os.getenv("TLS_CERT_FILE"),
            tls_key_file=os.getenv("TLS_KEY_FILE"),
        )
