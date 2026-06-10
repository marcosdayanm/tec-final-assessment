# ML Service

Servicio FastAPI para entrenamiento e inferencia del modelo de clasificacion SMS usado por ITChat.

## Requisitos

- Python 3.11 o superior
- Variables de entorno configuradas en `.env`

## Instalacion

```bash
cd ml-service
uv sync --group dev
cp .env.example .env
```

## Configuracion

- `MODEL_PATH`: ruta del artefacto `.pkl`
- `DATASET_PATH`: ruta del dataset CSV
- `HOST`: host de arranque
- `PORT`: puerto del servicio
- `TLS_CERT_FILE`: certificado TLS opcional
- `TLS_KEY_FILE`: llave TLS opcional

## Entrenamiento

```bash
cd ml-service
uv run train-sms-model
```

## Ejecucion

```bash
cd ml-service
uv run main
```

## Endpoint

- `POST /predict`

Body:

```json
{
  "message": "verify your bank account"
}
```

Respuesta:

```json
{
  "label": "smishing"
}
```

## Pruebas

```bash
cd ml-service
uv run pytest
```
