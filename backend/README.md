# Backend

API de mensajería directa construida con FastAPI, SQLAlchemy y PostgreSQL. Cada mensaje se clasifica al momento de guardarse llamando a un servicio ML externo.

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
- `ML_SERVICE_URL`: URL base del servicio ML
- `ML_SERVICE_PREDICT_PATH`: ruta del endpoint de predicción
- `ML_SERVICE_TIMEOUT_SECONDS`: timeout para la llamada HTTP al servicio ML
- `UNCLASSIFIED_LABEL`: etiqueta de respaldo si la clasificación falla
- `CORS_ALLOW_ORIGINS`: lista separada por comas con orígenes permitidos
- `HOST`: host de arranque
- `PORT`: puerto de arranque
- `TLS_CERT_FILE`: certificado TLS opcional
- `TLS_KEY_FILE`: llave TLS opcional

## Ejecución

```bash
cd backend
uv run main
```

El backend espera que el servicio ML esté levantado en la URL configurada por `ML_SERVICE_URL`.

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
