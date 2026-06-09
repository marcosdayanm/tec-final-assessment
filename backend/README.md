# Backend

API de mensajería directa construida con FastAPI, SQLAlchemy y PostgreSQL. Cada mensaje se clasifica al momento de guardarse con el modelo entrenado en `data/models/sms_linear_svm.pkl`.

## Requisitos

- Python 3.11 o superior
- PostgreSQL disponible
- Variables de entorno configuradas en `.env`

## Instalación

```bash
cd backend
uv sync --group dev
cp .env.example .env
```

## Configuración

Variables principales:

- `DATABASE_URL`: conexión a PostgreSQL
- `JWT_SECRET_KEY`: clave para firmar tokens
- `JWT_ALGORITHM`: algoritmo JWT
- `JWT_EXPIRE_MINUTES`: duración del token
- `MODEL_PATH`: ruta del archivo `.pkl`
- `HOST`: host de arranque
- `PORT`: puerto de arranque
- `TLS_CERT_FILE`: certificado TLS opcional
- `TLS_KEY_FILE`: llave TLS opcional

## Ejecución

```bash
cd backend
uv run main
```

Para desarrollo con HTTPS, la opción recomendada es usar un reverse proxy como Caddy delante de Uvicorn.
Si la base indicada en `DATABASE_URL` no existe y el motor es PostgreSQL, el backend intenta crearla al arrancar. Después crea las tablas del esquema automáticamente.

## Endpoints

- `POST /v1/register`
- `POST /v1/login`
- `GET /v1/users/search`
- `GET /v1/conversations`
- `POST /v1/conversations/direct/{target_user_id}`
- `GET /v1/direct_messages/{conversation_id}`
- `POST /v1/messages`
- `GET /v1/ws?token=<jwt>`

## Pruebas

```bash
cd backend
uv run pytest
```
