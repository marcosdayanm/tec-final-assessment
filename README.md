# ITChat

Aplicación de mensajería directa en tiempo real con detección automática de amenazas. Cada mensaje enviado se clasifica al momento mediante un modelo de Machine Learning (LinearSVC entrenado con scikit-learn) que lo etiqueta como **legítimo (ham)**, **spam** o **smishing (phishing por SMS)**. La etiqueta se persiste en la base de datos y llega al destinatario en tiempo real por WebSocket.

## Arquitectura

El repositorio está dividido en tres servicios independientes:

| Servicio      | Stack                          | Puerto | Rol                                                                 |
|---------------|--------------------------------|--------|---------------------------------------------------------------------|
| `ml-service/` | FastAPI + scikit-learn         | `8001` | Entrena el modelo y expone `POST /predict` para clasificar mensajes |
| `backend/`    | FastAPI + SQLAlchemy + PostgreSQL | `8000` | API de mensajería, autenticación JWT y WebSocket en tiempo real     |
| `frontend/`   | Vite + React + TypeScript      | `5173` | Cliente web (login, lista de chats, ventana de conversación)        |

Flujo de comunicación:

```
frontend  ──HTTP REST + WebSocket──▶  backend  ──HTTP REST (JWT de servicio)──▶  ml-service
 (5173)                               (8000)                                      (8001)
                                         │
                                         ▼
                                   PostgreSQL
```

Cuando el backend recibe un mensaje, llama al `ml-service` para clasificarlo, guarda el resultado en PostgreSQL y notifica al destinatario por WebSocket. La autenticación entre backend y ml-service usa un JWT de servicio firmado con un secreto compartido.

La documentación detallada (modelo de datos, pipeline de ML, referencia completa de endpoints, red y despliegue) está en [`DOCUMENTACION.md`](./DOCUMENTACION.md).

## Requisitos previos

| Herramienta | Versión mínima | Instalación                                          |
|-------------|----------------|------------------------------------------------------|
| Python      | 3.11           | https://python.org                                   |
| uv          | cualquiera     | `curl -Lsf https://astral.sh/uv/install.sh \| sh`    |
| PostgreSQL  | 14+            | https://postgresql.org (o vía Docker)                |
| Node.js     | 18+            | https://nodejs.org                                   |

## Cómo levantar el proyecto

Levanta los servicios en este orden: **PostgreSQL → ml-service → backend → frontend**.

### 0. PostgreSQL

Asegúrate de tener una instancia de PostgreSQL corriendo. Opción rápida con Docker:

```bash
docker run -d --name itchat-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

El backend crea la base de datos `itchat` y sus tablas automáticamente al arrancar si no existen.

### 1. ml-service (puerto 8001)

```bash
cd ml-service
uv sync --group dev
cp .env.example .env
uv run train-sms-model   # genera data/models/sms_linear_svm.pkl (solo la primera vez)
uv run main
```

### 2. backend (puerto 8000)

En otra terminal:

```bash
cd backend
uv sync --group dev
cp .env.example .env
uv run main
```

El backend arranca en http://127.0.0.1:8000 y espera al ml-service en la URL configurada por `ML_SERVICE_URL`.

> El secreto JWT de servicio debe coincidir entre ambos servicios: `ML_SERVICE_JWT_SECRET_KEY` (backend) debe ser igual a `SERVICE_JWT_SECRET_KEY` (ml-service). Los valores por defecto de los `.env.example` ya están alineados para desarrollo local.

### 3. frontend (puerto 5173)

En otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

El frontend queda disponible en http://localhost:5173. En desarrollo, Vite hace proxy de `/v1` y `/health` hacia el backend definido en `VITE_BACKEND_TARGET`, por lo que los valores por defecto del `.env.example` funcionan sin cambios.

Build de producción:

```bash
npm run build   # genera frontend/dist/
```

## Pruebas

```bash
# Backend (usa SQLite en memoria y un stub del modelo; no requiere PostgreSQL ni el .pkl)
cd backend && uv run pytest

# ml-service
cd ml-service && uv run pytest
```

## Variables de entorno

Cada servicio tiene su propio `.env.example` que se copia a `.env`. Las variables clave:

### backend (`backend/.env`)

| Variable                   | Descripción                                          | Por defecto                                                     |
|----------------------------|------------------------------------------------------|----------------------------------------------------------------|
| `DATABASE_URL`             | Conexión a PostgreSQL                                | `postgresql+psycopg://postgres:postgres@localhost:5432/itchat` |
| `JWT_SECRET_KEY`           | Clave para firmar los JWT de usuario                 | `change-this-secret-before-production`                         |
| `ML_SERVICE_URL`           | URL base del ml-service                              | `http://127.0.0.1:8001`                                        |
| `ML_SERVICE_JWT_SECRET_KEY`| Secreto compartido para autenticar al ml-service     | `change-before-prod`                                           |
| `CORS_ALLOW_ORIGINS`       | Orígenes permitidos (separados por coma)             | `http://localhost:5173,http://127.0.0.1:5173`                  |
| `HOST` / `PORT`            | Host y puerto de arranque                            | `127.0.0.1` / `8000`                                           |

### ml-service (`ml-service/.env`)

| Variable                | Descripción                                       | Por defecto                       |
|-------------------------|---------------------------------------------------|-----------------------------------|
| `MODEL_PATH`            | Ruta del artefacto `.pkl` del modelo              | `data/models/sms_linear_svm.pkl`  |
| `DATASET_PATH`          | Ruta del dataset CSV de entrenamiento             | `data/dataset.csv`                |
| `SERVICE_JWT_SECRET_KEY`| Secreto compartido para validar al backend        | `change-before-prod`              |
| `HOST` / `PORT`         | Host y puerto de arranque                          | `127.0.0.1` / `8001`              |

### frontend (`frontend/.env`)

| Variable             | Descripción                                         | Por defecto              |
|----------------------|-----------------------------------------------------|--------------------------|
| `VITE_API_URL`       | URL base del backend (vacío = usa el proxy de Vite) | _(vacío)_                |
| `VITE_WS_URL`        | URL del WebSocket (vacío = usa el proxy de Vite)    | _(vacío)_                |
| `VITE_BACKEND_TARGET`| Destino del proxy de Vite hacia el backend          | `http://127.0.0.1:8000`  |

## Estructura del repositorio

```text
backend/      API de mensajería (FastAPI + PostgreSQL + WebSocket)
ml-service/   Servicio de entrenamiento e inferencia del modelo (FastAPI)
frontend/     Cliente web (Vite + React + TypeScript)
DOCUMENTACION.md  Documentación detallada del proyecto
```
