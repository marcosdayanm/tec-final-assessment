from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import Settings
from src.ml.predictor import SMSModelService
from src.schemas import PredictionRequest, PredictionResponse
from src.service_auth import verify_service_token


service_bearer_scheme = HTTPBearer(auto_error=False)


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


def get_runtime(request: Request) -> ApplicationRuntime:
    return request.app.state.runtime


def require_service_token(
    runtime: ApplicationRuntime = Depends(get_runtime),
    credentials: HTTPAuthorizationCredentials | None = Depends(service_bearer_scheme),
) -> dict[str, str]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing service bearer token.",
        )
    return verify_service_token(credentials.credentials, runtime.settings)


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    payload: PredictionRequest,
    request: Request,
    _: dict[str, str] = Depends(require_service_token),
) -> PredictionResponse:
    runtime: ApplicationRuntime = request.app.state.runtime
    label = runtime.model_service.predict_label(payload.message)
    return PredictionResponse(label=label)
