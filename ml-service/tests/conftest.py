from collections.abc import Iterator
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient

from src.app import ApplicationRuntime, app, application_runtime
from src.config import Settings


class FakeModel:
    def predict(self, values: list[str]) -> list[str]:
        message = values[0].lower()
        if "bank" in message or "verify" in message:
            return ["smishing"]
        if "prize" in message or "winner" in message:
            return ["spam"]
        return ["ham"]


@pytest.fixture
def model_path() -> Iterator[Path]:
    with TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / "sms_linear_svm.pkl"
        import pickle

        with temp_path.open("wb") as file:
            pickle.dump(FakeModel(), file)
        yield temp_path


@pytest.fixture
def client(model_path: Path) -> Iterator[TestClient]:
    test_settings = Settings(
        model_path=model_path,
        dataset_path=model_path.parent / "dataset.csv",
        service_jwt_secret_key="test-ml-secret-key-with-32-bytes-minimum",
        service_jwt_algorithm="HS256",
        service_jwt_issuer="itchat-backend",
        service_jwt_audience="itchat-ml-service",
        service_jwt_subject="itchat-backend-service",
        host="127.0.0.1",
        port=8001,
        tls_cert_file=None,
        tls_key_file=None,
    )
    test_runtime = ApplicationRuntime(settings=test_settings)
    original_runtime = application_runtime
    import src.app as app_module

    app_module.application_runtime = test_runtime
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app_module.application_runtime = original_runtime
