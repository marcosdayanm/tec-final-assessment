from collections.abc import Iterator
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient

from src.app import ApplicationRuntime, app, application_runtime
from src.config import BASE_DIR, Settings


class StubModelService:
    def predict_label(self, message: str) -> str:
        lowered = message.lower()
        if "bank" in lowered or "verify" in lowered:
            return "smishing"
        if "prize" in lowered or "winner" in lowered:
            return "spam"
        return "ham"


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TemporaryDirectory() as temp_dir:
        database_url = f"sqlite+aiosqlite:///{Path(temp_dir) / 'test.db'}"
        test_settings = Settings(
            database_url=database_url,
            jwt_secret_key="test-secret-key-with-32-bytes-minimum",
            jwt_algorithm="HS256",
            jwt_expire_minutes=30,
            model_path=BASE_DIR / "data" / "models" / "sms_linear_svm.pkl",
            tls_cert_file=None,
            tls_key_file=None,
            host="127.0.0.1",
            port=8000,
        )
        test_runtime = ApplicationRuntime.from_settings(test_settings)
        original_runtime = application_runtime
        import src.app as app_module

        app_module.application_runtime = test_runtime
        try:
            with TestClient(app) as test_client:
                test_client.app.state.runtime.model_service = StubModelService()
                yield test_client
        finally:
            app_module.application_runtime = original_runtime
