# ITChat — Documentación del Proyecto

## ¿Qué es ITChat?

ITChat es una aplicación de mensajería directa en tiempo real con detección automática de amenazas en mensajes. Cada mensaje enviado es clasificado instantáneamente por un modelo de Machine Learning (LinearSVC entrenado con scikit-learn) que lo etiqueta como **legítimo (ham)**, **spam** o **smishing (phishing por SMS)**. La etiqueta se persiste en la base de datos y el destinatario la recibe en tiempo real a través de WebSocket.

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│                React 18 + TypeScript + Vite                         │
│                                                                     │
│  ┌─────────────────┐      ┌──────────────────────────────────────┐  │
│  │   Login /        │      │           Dashboard                  │  │
│  │   Register       │─────▶│  Sidebar (lista de chats)           │  │
│  │   Pages          │      │  + ChatWindow (mensajes + input)     │  │
│  └─────────────────┘      └──────────────────────────────────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              HTTP REST (fetch)  │  WebSocket (/v1/ws?token=…)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           BACKEND                                   │
│               FastAPI + SQLAlchemy + Uvicorn (Python)               │
│                                                                     │
│  POST /v1/register          →  Registro de usuario                  │
│  POST /v1/login             →  Autenticación JWT                    │
│  GET  /v1/users/search      →  Buscar otros usuarios                │
│  GET  /v1/conversations     →  Listar conversaciones del usuario    │
│  POST /v1/conversations/direct/{id}  →  Crear/obtener chat directo │
│  GET  /v1/direct_messages/{id}       →  Historial de mensajes      │
│  POST /v1/messages          →  Enviar mensaje (clasifica con ML)    │
│  WS   /v1/ws?token=…        →  Canal en tiempo real (push events)   │
│  GET  /health               →  Health check                         │
└────────────────┬───────────────────────┬────────────────────────────┘
                 │                       │
          SQL (async)            pickle.load()
                 ▼                       ▼
┌────────────────────────┐   ┌──────────────────────────────────────┐
│  PostgreSQL / SQLite   │   │          Modelo ML                   │
│                        │   │  scikit-learn Pipeline (LinearSVC)   │
│  users                 │   │                                      │
│  conversations         │   │  FeatureBuilder                      │
│  conversation_         │   │  → ColumnTransformer                 │
│    participants        │   │    (TF-IDF + MaxAbsScaler)           │
│  messages              │   │  → LinearSVC                         │
│                        │   │                                      │
│                        │   │  Artefacto: data/models/             │
│                        │   │  sms_linear_svm.pkl                  │
└────────────────────────┘   └──────────────────────────────────────┘
```
## Base de Datos

El backend usa PostgreSQL en producción y SQLite en tests. Las tablas se crean automáticamente al arrancar el servidor.

| Tabla                      | Columnas principales                                                       |
|----------------------------|----------------------------------------------------------------------------|
| `users`                    | `id`, `username`, `password_hash`, `created_at`                           |
| `conversations`            | `id`, `created_at`                                                         |
| `conversation_participants`| `id`, `conversation_id`, `user_id`                                         |
| `messages`                 | `id`, `conversation_id`, `sender_id`, `content`, `classification_label`, `created_at` |

---

## Autenticación

- Las contraseñas se hashean con PBKDF2-SHA256 (600,000 iteraciones + salt aleatorio).
- Al hacer login o register se devuelve un JWT con `user_id`, `username` y `exp`.
- Todos los endpoints protegidos requieren el header: `Authorization: Bearer <token>`.

---

## Pipeline de Machine Learning

El modelo clasifica mensajes en tres categorías.

### Flujo de entrenamiento

```
dataset.csv  →  FeatureBuilder  →  ColumnTransformer  →  LinearSVC  →  sms_linear_svm.pkl
```

**FeatureBuilder** extrae estas features de cada mensaje:

| Feature             | Descripción                                          |
|---------------------|------------------------------------------------------|
| `clean_text`        | Texto en minúsculas; URLs → `__url__`, emails → `__email__`, teléfonos → `__phone__` |
| `message_length`    | Longitud total del mensaje                           |
| `word_count`        | Cantidad de palabras                                 |
| `digit_count`       | Cantidad de dígitos                                  |
| `exclamation_count` | Cantidad de signos `!`                               |

### Etiquetas de clasificación

| Etiqueta   | Significado                              |
|------------|------------------------------------------|
| `ham`      | Mensaje legítimo                         |
| `spam`     | Publicidad o mensaje no deseado          |
| `smishing` | SMS phishing — intento de robo de datos  |

La etiqueta se guarda en la columna `classification_label` de cada mensaje en la BD.

---

## Flujo de la Aplicación

1. El usuario se registra o inicia sesión y recibe un JWT token.
2. El frontend abre una conexión WebSocket a `/v1/ws?token=<jwt>` para recibir mensajes en tiempo real.
3. El usuario busca a otro usuario por nombre (`GET /v1/users/search`) y abre un chat directo.
4. Al enviar un mensaje (`POST /v1/messages`):
   - El backend clasifica el contenido con el modelo ML.
   - Guarda el mensaje en PostgreSQL con la etiqueta resultante.
   - Envía un evento `message_created` vía WebSocket al destinatario.
5. El destinatario ve el mensaje en tiempo real con la etiqueta de amenaza ya resuelta.

---

## API — Referencia de Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `POST` | `/v1/register` | No | Crear cuenta nueva |
| `POST` | `/v1/login` | No | Iniciar sesión, devuelve JWT |
| `GET` | `/v1/users/search?query=` | Sí | Buscar usuarios por nombre |
| `GET` | `/v1/conversations` | Sí | Listar chats del usuario |
| `POST` | `/v1/conversations/direct/{id}` | Sí | Crear o recuperar chat directo |
| `GET` | `/v1/direct_messages/{id}` | Sí | Historial de mensajes de un chat |
| `POST` | `/v1/messages` | Sí | Enviar mensaje (clasifica con ML) |
| `WS` | `/v1/ws?token=` | JWT en query | Canal push en tiempo real |
| `GET` | `/health` | No | Health check |

### Evento WebSocket recibido

```json
{
  "type": "message_created",
  "conversation_id": 1,
  "message": {
    "id": 42,
    "conversation_id": 1,
    "sender_id": 2,
    "content": "Verifica tu cuenta bancaria",
    "classification_label": "smishing",
    "created_at": "2026-06-08T18:00:00Z"
  },
  "sender": { "id": 2, "username": "otro_usuario" },
  "created_at": "2026-06-08T18:00:00Z"
}
```

---

## Cómo Correr el Proyecto

### Requisitos previos

| Herramienta | Versión mínima | Instalar                                         |
|-------------|----------------|--------------------------------------------------|
| Python      | 3.11           | https://python.org                               |
| uv          | cualquiera     | `curl -Lsf https://astral.sh/uv/install.sh \| sh`|
| PostgreSQL  | 14+            | https://postgresql.org (o via Docker)            |
| Node.js     | 18+            | https://nodejs.org                               |
| npm         | 9+             | Viene incluido con Node.js                       |

> PostgreSQL con Docker (opción rápida):
> ```bash
> docker run -d --name itchat-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
> ```

---

### 1. Backend

```bash
cd backend
```

#### 1.1 Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y ajusta al menos estas dos variables:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/itchat
JWT_SECRET_KEY=pon-aqui-una-clave-secreta-larga-y-segura
```

Las demás tienen valores por defecto funcionales.

#### 1.2 Instalar dependencias

```bash
uv sync --group dev
```

#### 1.3 Entrenar el modelo ML

Genera `data/models/sms_linear_svm.pkl` — solo se necesita hacer una vez.

```bash
uv run train-sms-model
```

Salida esperada:
```
              precision    recall  f1-score   support
     ...
Saved trained model to data/models/sms_linear_svm.pkl
Metrics: {'accuracy': 0.xxxx, 'macro_f1': 0.xxxx}
```

#### 1.4 Levantar el servidor

```bash
uv run main
```

El servidor arranca en **http://127.0.0.1:8000**.  
La base de datos y las tablas se crean automáticamente si no existen.

---

### 2. Frontend

```bash
cd frontend
```

#### 2.1 Configurar variables de entorno

```bash
cp .env.example .env
```

Contenido por defecto (no necesita cambios si el backend corre local):

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/v1/ws
```

#### 2.2 Instalar dependencias

```bash
npm install
```

#### 2.3 Levantar el servidor de desarrollo

```bash
npm run dev
```

El frontend estará en **http://localhost:5173**.

#### 2.4 Build para producción

```bash
npm run build
```

Genera los archivos estáticos en `frontend/dist/`.

### Correr los tests del backend

```bash
cd backend
uv run pytest
```

Los tests usan SQLite en memoria y un stub del modelo, por lo que no requieren PostgreSQL ni el `.pkl` entrenado.

---

## Variables de Entorno

### Backend (`backend/.env`)

| Variable            | Descripción                              | Valor por defecto                                         |
|---------------------|------------------------------------------|-----------------------------------------------------------|
| `DATABASE_URL`      | URL de conexión a la base de datos       | `postgresql+psycopg://postgres:postgres@localhost:5432/itchat` |
| `JWT_SECRET_KEY`    | Clave secreta para firmar tokens JWT     | `change-this-secret-before-production`                    |
| `JWT_ALGORITHM`     | Algoritmo JWT                            | `HS256`                                                   |
| `JWT_EXPIRE_MINUTES`| Duración del token en minutos            | `60`                                                      |
| `MODEL_PATH`        | Ruta al archivo `.pkl` del modelo        | `data/models/sms_linear_svm.pkl`                          |
| `HOST`              | Host en que escucha Uvicorn              | `127.0.0.1`                                               |
| `PORT`              | Puerto de Uvicorn                        | `8000`                                                    |
| `TLS_CERT_FILE`     | Certificado TLS (opcional)               | —                                                         |
| `TLS_KEY_FILE`      | Llave TLS (opcional)                     | —                                                         |

### Frontend (`frontend/.env`)

| Variable       | Descripción                            | Valor por defecto         |
|----------------|----------------------------------------|---------------------------|
| `VITE_API_URL` | URL base del backend (REST)            | `http://localhost:8000`   |
| `VITE_WS_URL`  | URL base del WebSocket                 | `ws://localhost:8000/v1/ws` |

---

## Dependencias Principales

### Backend (Python)

| Paquete          | Rol                                              |
|------------------|--------------------------------------------------|
| `fastapi`        | Framework web async (rutas, validación, OpenAPI) |
| `uvicorn`        | Servidor ASGI                                    |
| `sqlalchemy`     | ORM async (modelos + queries)                    |
| `psycopg`        | Driver async para PostgreSQL                     |
| `aiosqlite`      | Driver async para SQLite (tests)                 |
| `pyjwt`          | Generación y validación de JWT                   |
| `python-dotenv`  | Carga de variables desde `.env`                  |
| `scikit-learn`   | Pipeline ML (TF-IDF, LinearSVC, Scaler)          |
| `pandas`         | Carga del dataset y manipulación de datos        |

### Frontend (Node.js)

| Paquete               | Rol                              |
|-----------------------|----------------------------------|
| `react` + `react-dom` | UI declarativa                   |
| `vite`                | Build tool y dev server          |
| `typescript`          | Tipado estático                  |
| `@vitejs/plugin-react`| Soporte JSX/React para Vite      |
