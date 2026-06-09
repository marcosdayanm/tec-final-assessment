import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = DATA_DIR / "models"
DEFAULT_MODEL_PATH = MODELS_DIR / "sms_linear_svm.pkl"
DEFAULT_CONSOLIDATED_DATASET = DATA_DIR / "dataset.csv"


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_expire_minutes: int
    model_path: Path
    tls_cert_file: str | None
    tls_key_file: str | None
    host: str
    port: int

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        return cls(
            database_url=os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/chat_app"),
            jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-this-secret-before-production"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "60")),
            model_path=Path(os.getenv("MODEL_PATH", str(DEFAULT_MODEL_PATH))).expanduser(),
            tls_cert_file=os.getenv("TLS_CERT_FILE"),
            tls_key_file=os.getenv("TLS_KEY_FILE"),
            host=os.getenv("HOST", "127.0.0.1"),
            port=int(os.getenv("PORT", "8000")),
        )
