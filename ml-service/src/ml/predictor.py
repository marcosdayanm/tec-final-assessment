import pickle
from pathlib import Path
from typing import Any


class SMSModelService:
    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self._model: Any = self.load_model()

    def load_model(self) -> Any:
        # El .pkl contiene el pipeline completo (incluido el FeatureBuilder): mismo preprocesamiento que en entrenamiento.
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Model artifact not found at {self.model_path}. Train the model first."
            )

        with self.model_path.open("rb") as file:
            model = pickle.load(file)
        self._model = model
        return model

    def predict_label(self, message: str) -> str:
        if self._model is None:
            self.load_model()

        prediction = self._model.predict([message])
        return str(prediction[0])
