from pathlib import Path

import pytest

from src.ml.predictor import SMSModelService


class FakeModel:
    def predict(self, values: list[str]) -> list[str]:
        return ["ham"]


def test_model_service_loads_saved_artifact(tmp_path: Path) -> None:
    import pickle

    model_path = tmp_path / "sms_linear_svm.pkl"
    with model_path.open("wb") as file:
        pickle.dump(FakeModel(), file)

    service = SMSModelService(model_path)

    prediction = service.predict_label("Let's have lunch tomorrow.")

    assert prediction == "ham"


def test_model_service_raises_for_missing_model() -> None:
    with pytest.raises(FileNotFoundError):
        SMSModelService(Path("/tmp/does-not-exist.pkl"))
