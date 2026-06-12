from dataclasses import dataclass

import httpx

from src.config import Settings
from src.service_auth import create_ml_service_token


@dataclass
class SMSModelClient:
    settings: Settings
    base_url: str
    predict_path: str
    timeout_seconds: float
    fallback_label: str

    def __post_init__(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=self.base_url.rstrip("/"),
            timeout=self.timeout_seconds,
        )

    async def predict_label(self, message: str) -> str:
        try:
            response = await self._client.post(
                self.predict_path,
                json={"message": message},
                headers=self._build_auth_headers(),
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            # Si el ML service falla o tarda más que el timeout, no bloqueamos el chat: etiqueta de respaldo.
            return self.fallback_label

        label = payload.get("label")
        if not isinstance(label, str) or not label.strip():
            return self.fallback_label
        return label

    async def aclose(self) -> None:
        await self._client.aclose()

    def _build_auth_headers(self) -> dict[str, str]:
        token = create_ml_service_token(self.settings)
        return {"Authorization": f"Bearer {token}"}
