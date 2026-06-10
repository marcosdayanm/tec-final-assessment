import uvicorn

from src.app import app
from src.config import Settings


def main() -> None:
    settings = Settings.from_env()
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        ssl_certfile=settings.tls_cert_file,
        ssl_keyfile=settings.tls_key_file,
    )


if __name__ == "__main__":
    main()
