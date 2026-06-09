from pathlib import Path

import pytest

from src.config import BASE_DIR
from src.ml.predictor import SMSModelService


def test_model_service_loads_saved_artifact() -> None:
    service = SMSModelService(BASE_DIR / "data" / "models" / "sms_linear_svm.pkl")

    prediction = service.predict_label("Let's have lunch tomorrow.")

    assert prediction in {"ham", "spam", "smishing"}


def test_model_service_raises_for_missing_model() -> None:
    with pytest.raises(FileNotFoundError):
        SMSModelService(Path("/tmp/does-not-exist.pkl"))
