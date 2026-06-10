from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI, Request

from src.config import Settings
from src.ml.predictor import SMSModelService
from src.schemas import PredictionRequest, PredictionResponse


@dataclass
class ApplicationRuntime:
    settings: Settings
    model_service: SMSModelService | None = None

    async def initialize(self) -> None:
        self.model_service = SMSModelService(self.settings.model_path)


application_runtime = ApplicationRuntime(settings=Settings.from_env())


@asynccontextmanager
async def lifespan(application: FastAPI):
    await application_runtime.initialize()
    application.state.runtime = application_runtime
    yield


app = FastAPI(
    title="ITChat ML Service",
    version="1.0.0",
    description="Inference and training service for SMS message classification.",
    lifespan=lifespan,
)


@app.post("/predict", response_model=PredictionResponse)
async def predict(payload: PredictionRequest, request: Request) -> PredictionResponse:
    runtime: ApplicationRuntime = request.app.state.runtime
    label = runtime.model_service.predict_label(payload.message)
    return PredictionResponse(label=label)
