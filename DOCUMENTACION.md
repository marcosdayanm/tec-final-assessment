# ITChat — Documentación del Proyecto

**Detecta. Protege. Conversa seguro.**

Aplicación de mensajería directa (1 a 1) en tiempo real con clasificación automática de amenazas mediante Machine Learning, desplegada sobre infraestructura de red y nube propia.

|             |                                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| **Entrega** | Final Assessment — Tec de Monterrey, Campus Santa Fe                             |
| **Fecha**   | Junio 2026                                                                       |
| **Equipo**  | Joseph Shakalo (A01784107) · Gabriel Edid (A01782146) · Marcos Dayan (A01782876) |

Esta es la documentación técnica completa del proyecto: arquitectura, API, red, configuraciones de despliegue y pruebas. La guía rápida para levantar el proyecto en local está en el [README](./README.md).

---

## 1. Visión del producto

ITChat es una aplicación de mensajería directa en tiempo real. Cada mensaje enviado se clasifica al instante con un modelo de Machine Learning; la etiqueta se persiste en la base de datos y el destinatario la recibe vía WebSocket junto con el mensaje, sin estados intermedios visibles.

| Etiqueta       | Significado                                                         |
| -------------- | ------------------------------------------------------------------- |
| `ham`          | Mensaje legítimo: conversación normal entre usuarios.               |
| `spam`         | Publicidad o mensaje no deseado: promociones, ofertas masivas.      |
| `smishing`     | Phishing por SMS: intento de robo de datos o credenciales.          |
| `unclassified` | Etiqueta de respaldo si la clasificación falla o excede el timeout. |

---

## 2. Arquitectura del sistema

El sistema está compuesto por **cuatro servicios desacoplados**, cada uno desplegable en su propia instancia. Conviven en un solo repositorio (monorepo) con dependencias independientes por servicio (`uv` para Python, `npm` para el frontend). La comunicación es solo por HTTP(S) y WebSocket: sin acoplamiento.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  ·  React 18 + TypeScript + Vite (SPA)                           │
│  Login/Registro · Dashboard (sidebar de chats + ChatWindow)                │
└───────────────────────────────┬──────────────────────────────────────────┘
            REST + JWT (HTTPS)   │   WebSocket  /v1/ws?token=<jwt>
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LOAD BALANCER · nginx L7 - TLS termination + rate limiting anti-DDoS    │
│  least_conn · health checks pasivos · upgrade de WebSocket               │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  BACKEND  ·  FastAPI + SQLAlchemy 2.0 async + Uvicorn  (1..N réplicas)   │
│  Auth JWT · conversaciones · mensajes · canal realtime                     │
└──────────┬──────────────────────────────────────┬─────────────────────────┘
           │ SQL async (psycopg)                  │ HTTPS + JWT de servicio (60 s)
           ▼                                       ▼
┌────────────────────────┐         ┌──────────────────────────────────────────┐
│  PostgreSQL            │         │  ML SERVICE  ·  FastAPI + scikit-learn     │
│  users · conversations │         │  POST /predict  →  { "label": ... }        │
│  conversation_         │         │  Pipeline LinearSVC (sms_linear_svm.pkl)   │
│  participants · messages│        │  Solo acepta tokens del backend            │
└────────────────────────┘         └──────────────────────────────────────────┘
```

**Principios de diseño:**

- Cada servicio se despliega en su propia instancia de la nube y escala de forma independiente.
- El backend nunca ejecuta el modelo: delega la inferencia al ML service por HTTP. Así el modelo se puede actualizar (nuevo `.pkl`) sin tocar el backend ni el frontend.
- El ML service solo acepta tokens emitidos por el backend; jamás recibe tráfico directo de usuarios (superficie de ataque aislada).
- Si el ML service falla o se agota el timeout, el mensaje se guarda como `unclassified`: el chat nunca se bloquea por el modelo.

| Servicio      | Stack                                | Puerto | Rol                                                   |
| ------------- | ------------------------------------ | ------ | ----------------------------------------------------- |
| `frontend/`   | React 18 + TypeScript + Vite         | `5173` | SPA: login, lista de chats, ventana de conversación   |
| `backend/`    | FastAPI + SQLAlchemy async + Uvicorn | `8000` | API REST, autenticación JWT, WebSocket en tiempo real |
| `ml-service/` | FastAPI + scikit-learn               | `8001` | Entrenamiento e inferencia del clasificador SMS       |
| PostgreSQL    | PostgreSQL 16                        | `5432` | Persistencia relacional                               |

### Estructura del repositorio (monorepo)

```text
tec-final-assessment/
├── backend/                  API de mensajería (FastAPI + PostgreSQL + WebSocket)
│   ├── src/
│   │   ├── app.py            Rutas HTTP/WebSocket y wiring de la aplicación
│   │   ├── auth.py           Hashing PBKDF2 y JWT de usuario
│   │   ├── chat.py           Queries y operaciones de dominio (chats, mensajes)
│   │   ├── config.py         Settings desde variables de entorno
│   │   ├── db.py             Modelos SQLAlchemy y bootstrap de la BD
│   │   ├── ml_client.py      Cliente HTTP hacia el ML service
│   │   ├── realtime.py       ConnectionManager de WebSockets
│   │   ├── schemas.py        DTOs Pydantic (request/response)
│   │   └── service_auth.py   Emisión del JWT de servicio
│   ├── tests/                15 pruebas (pytest)
│   └── pyproject.toml
├── ml-service/               Entrenamiento e inferencia del modelo (FastAPI)
│   ├── src/
│   │   ├── app.py            Endpoint POST /predict
│   │   ├── service_auth.py   Validación del JWT de servicio
│   │   ├── ml/
│   │   │   ├── features.py   FeatureBuilder (transformer custom)
│   │   │   └── predictor.py  Carga del .pkl e inferencia
│   │   └── scripts/
│   │       └── train_model.py  Entrenamiento del pipeline
│   ├── data/
│   │   ├── dataset.csv       Mensajes etiquetados (ham/spam/smishing)
│   │   └── models/           sms_linear_svm.pkl (generado al entrenar)
│   ├── tests/                7 pruebas (pytest)
│   └── pyproject.toml
├── frontend/                 Cliente web (Vite + React + TypeScript)
│   ├── src/
│   │   ├── api/chat.ts       Capa de acceso REST + WebSocket
│   │   ├── pages/            Login.tsx, Dashboard.tsx
│   │   ├── components/       ChatWindow, Message, Avatar, ThemeToggle
│   │   ├── hooks/            useRealtimeMessages, useTheme
│   │   ├── config.ts
│   │   └── types.ts
│   ├── vite.config.ts        Proxy /v1 y /health hacia el backend
│   └── package.json
├── cloud/                    cloud-init de OpenStack + nginx del load balancer
├── docs/img/                 Capturas de la interfaz
├── README.md                 Guía rápida para levantar el proyecto
└── DOCUMENTACION.md          Esta documentación
```

---

## 3. Frontend

SPA construida con React 18, TypeScript y Vite.

- **Páginas:** Login/registro (con `bio` y `avatar`), Dashboard con sidebar de conversaciones, búsqueda de usuarios y `ChatWindow`.
- **Sesión persistente:** el JWT y los datos del usuario se guardan en `localStorage`; la sesión sobrevive recargas.
- **Tiempo real:** un único WebSocket por usuario autenticado (no por chat) que reacciona a eventos `message_created`.
- **Capa de API:** `frontend/src/api/chat.ts` centraliza el `fetch` REST y la URL del WebSocket; la configuración vive en `frontend/src/config.ts`.

**UI/UX y accesibilidad:**

- Tema claro/oscuro con toggle persistente.
- Registro con validación en formulario.
- Badges de clasificación con color + icono + texto (no solo color, por accesibilidad).
- Estados visibles ante fallos del ML (`unclassified`).
- Mostrar/ocultar contraseña.

Archivos clave: `src/App.tsx` (sesión), `src/pages/Login.tsx`, `src/pages/Dashboard.tsx` (orquestador de estado), `src/components/ChatWindow.tsx`, `src/components/Message.tsx`, `src/hooks/useRealtimeMessages.ts` (socket), `src/types.ts`.

### Capturas de pantalla

**Inicio de sesión y registro**

El registro incluye `bio` y foto de perfil opcionales, con mostrar/ocultar contraseña.

![Pantalla de inicio de sesión](docs/img/login-dark.jpg)

![Pantalla de registro con bio y avatar opcionales](docs/img/register-dark.jpg)

**Dashboard con clasificación en tiempo real**

Cada mensaje llega con su badge de clasificación (`spam`, `smishing` o `clasificación no disponible`). La interfaz soporta tema oscuro y claro de forma persistente.

![Dashboard en tema oscuro con badges de clasificación](docs/img/dashboard-dark.jpg)

![Dashboard en tema claro](docs/img/dashboard-light.jpg)

---

## 4. Backend y API REST

Stack: **FastAPI + SQLAlchemy 2.0 async + Uvicorn**, con driver `psycopg` (PostgreSQL) y `aiosqlite` (tests).

- **Servicio systemd:** en producción corre como `itchat-backend.service` con `Restart=always`; si el proceso cae, se reinicia solo en ~5 s.
- **Auto-bootstrap:** al arrancar crea la base de datos `itchat` y sus tablas si no existen (cero pasos manuales). Lógica en `backend/src/db.py`.
- **CORS:** `CORS_ALLOW_ORIGINS` limita los orígenes del frontend permitidos.

### 4.1 Referencia de endpoints

Todos los endpoints protegidos requieren el header `Authorization: Bearer <jwt>`.

| Método | Ruta                                        | Auth         | Descripción                                             |
| ------ | ------------------------------------------- | ------------ | ------------------------------------------------------- |
| `POST` | `/v1/register`                              | No           | Crear cuenta nueva, devuelve JWT                        |
| `POST` | `/v1/login`                                 | No           | Iniciar sesión, devuelve JWT                            |
| `GET`  | `/v1/users/search?query=`                   | JWT          | Buscar usuarios por nombre (excluye al propio usuario)  |
| `GET`  | `/v1/conversations`                         | JWT          | Listar chats del usuario (ordenados por último mensaje) |
| `POST` | `/v1/conversations/direct/{target_user_id}` | JWT          | Crear o recuperar chat directo                          |
| `GET`  | `/v1/direct_messages/{conversation_id}`     | JWT          | Historial de mensajes de un chat                        |
| `POST` | `/v1/messages`                              | JWT          | Enviar mensaje → clasifica con el ML service            |
| `WS`   | `/v1/ws?token=<jwt>`                        | JWT en query | Canal push en tiempo real (`message_created`)           |
| `GET`  | `/health`                                   | No           | Health check (lo consume el load balancer)              |

### 4.2 Contratos de request / response

**`POST /v1/register`** → `201 Created`

```jsonc
// request
{
  "username": "ana_lopez",        // 3-50 chars, [A-Za-z0-9_]
  "password": "supersecreta",     // 8-128 chars
  "email": "ana@example.com",
  "full_name": "Ana López",       // 1-120 chars
  "bio": "Hola!",                  // opcional, máx 2000
  "avatar_url": "https://..."      // opcional, máx 500
}
// response
{ "token": "<jwt>", "user": { "id": 1, "username": "ana_lopez", "full_name": "Ana López", "avatar_url": null } }
```

Devuelve `409 Conflict` si el `username` o el `email` ya existen.

**`POST /v1/login`** → `200 OK`

```jsonc
// request
{ "username": "ana_lopez", "password": "supersecreta" }
// response
{ "token": "<jwt>", "user": { "id": 1, "username": "ana_lopez", "full_name": "Ana López", "avatar_url": null } }
```

Devuelve `401 Unauthorized` si las credenciales son inválidas.

**`POST /v1/messages`** → `201 Created`

```jsonc
// request
{ "conversation_id": 1, "content": "Verifica tu cuenta bancaria" }
// response
{
  "message": {
    "id": 42, "conversation_id": 1, "sender_id": 2,
    "content": "Verifica tu cuenta bancaria",
    "classification_label": "smishing",
    "created_at": "2026-06-08T18:00:00Z"
  }
}
```

Al enviar, el backend clasifica el contenido con el ML service, persiste el mensaje con su `classification_label` y emite el evento por WebSocket al destinatario. Devuelve `404` si la conversación no pertenece al usuario.

**`POST /v1/conversations/direct/{target_user_id}`** → `200 OK` con la conversación (la crea si no existe). Devuelve `400` si el `target_user_id` es el propio usuario y `404` si el usuario destino no existe.

### 4.3 Tiempo real con WebSockets

1. **Conexión:** el frontend abre una sesión WebSocket al iniciar sesión. Un solo socket por usuario, no por chat.
2. **Validación:** el backend valida el JWT del query param y registra la conexión en el `ConnectionManager`.
3. **Push:** al guardarse un mensaje, el backend emite la creación del mensaje solo al destinatario conectado.

Evento recibido por el destinatario:

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
  "sender": {
    "id": 2,
    "username": "otro_usuario",
    "full_name": "Otro Usuario",
    "avatar_url": null
  },
  "created_at": "2026-06-08T18:00:00Z"
}
```

Si el destinatario está desconectado, el mensaje igual se persiste; lo verá al recargar el historial.

---

## 5. Persistencia: base de datos relacional (PostgreSQL)

PostgreSQL (`psycopg` async) en producción; SQLite en memoria (`aiosqlite`) en tests. Las tablas se crean automáticamente al arrancar el servidor.

| Tabla                       | Columnas clave                                                                                               | Relación                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `users`                     | `id`, `username` (unique), `email` (unique), `password_hash`, `full_name`, `bio`, `avatar_url`, `created_at` | —                                          |
| `conversations`             | `id`, `created_at`                                                                                           | 1:N con `messages` y `participants`        |
| `conversation_participants` | `id`, `conversation_id`, `user_id` (UNIQUE por par)                                                          | Tabla puente N:M usuarios ↔ conversaciones |
| `messages`                  | `id`, `conversation_id`, `sender_id`, `content`, `classification_label`, `created_at`                        | N:1 con conversación y remitente           |

- **Normalización (3FN):** sin grupos repetidos ni dependencias parciales o transitivas; los participantes viven en su tabla puente, no en una columna-lista. La restricción `UNIQUE(conversation_id, user_id)` evita participantes duplicados.
- **Históricos:** todo mensaje queda persistido con su `classification_label` y `created_at`: el historial conserva la evidencia de amenazas.
- **Integridad referencial:** las claves foráneas usan `ON DELETE CASCADE`.

---

## 6. Seguridad: defensa en capas

| Capa                          | Mecanismo                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contraseñas**               | PBKDF2-HMAC-SHA256 con 600,000 iteraciones + salt aleatorio por usuario. Nunca se guarda texto plano. Se almacena en formato `salt$digest`.                                                                                |
| **JWT de usuario**            | Login/registro devuelven token firmado (HS256, expira en 60 min). Los endpoints protegidos exigen `Authorization: Bearer`.                                                                                                 |
| **JWT service-to-service**    | Backend ↔ ML service usan un segundo sistema JWT con secreto, `issuer`, `audience` y `subject` propios, y expiración de 60 segundos. El ML service valida firma, issuer, audience y subject antes de ejecutar el pipeline. |
| **Base de datos**             | `pg_hba.conf` solo acepta conexiones del CIDR de los backends, con autenticación `scram-sha-256`.                                                                                                                          |
| **Red**                       | Hacia la red del Tec solo se exponen los puertos `443` (HTTPS) y `22` (SSH); SSH únicamente a través del jump server.                                                                                                      |
| **CORS**                      | `CORS_ALLOW_ORIGINS` limita el origen del frontend permitido en producción.                                                                                                                                                |
| **HTTPS / TLS**               | El load balancer termina TLS con certificados HTTPS; frontend y API se sirven sobre HTTPS (puerto `443`).                                                                                                                  |
| **Rate limiting (anti-DDoS)** | En el LB, `limit_req_zone` (10 req/s por IP) y `limit_conn_zone` acotan peticiones y conexiones concurrentes por IP, mitigando floods y abuso volumétrico básico.                                                          |

---

## 7. Machine Learning

### 7.1 Dataset: tres fuentes reales reconciliadas

**19,417 mensajes SMS** consolidados a partir de tres fuentes públicas:

| Fuente                                         | Aporte                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Mishra & Soni (2022) — Mendeley, CC BY 4.0     | Fuente principal: ya trae las 3 clases (ham, spam, smishing).    |
| UCI SMS Spam Collection                        | Benchmark clásico: refuerza `ham` y `spam`.                      |
| Combined Smishing Dataset (Hosseinpour et al.) | Consolida varias fuentes públicas: refuerza `smishing` y `spam`. |

Distribución de clases en `ml-service/data/dataset.csv`: `ham` ≈ 5,133 · `spam` ≈ 7,142 · `smishing` ≈ 7,142.

### 7.2 Pipeline de clasificación (scikit-learn)

```
dataset.csv → FeatureBuilder → ColumnTransformer → LinearSVC → sms_linear_svm.pkl
```

**FeatureBuilder** (transformer custom) extrae de cada mensaje:

| Feature             | Descripción                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| `clean_text`        | Texto en minúsculas; URLs → `__url__`, emails → `__email__`, teléfonos → `__phone__` |
| `message_length`    | Longitud total del mensaje                                                           |
| `word_count`        | Cantidad de palabras                                                                 |
| `digit_count`       | Cantidad de dígitos                                                                  |
| `exclamation_count` | Cantidad de signos `!`                                                               |

**ColumnTransformer:**

- TF-IDF (1–2 gramas, `min_df=2`, stop words en inglés) sobre `clean_text`.
- `MaxAbsScaler` sobre las 4 features numéricas (normalización).
- Une todo en una sola matriz de features.

**Clasificador:** `LinearSVC` (margen máximo, `random_state=42`), elegido tras comparar tres modelos.

Como el `FeatureBuilder` es un transformer custom dentro del pipeline, el `.pkl` aplica exactamente el mismo preprocesamiento usado al entrenar: sin divergencia entre notebook y servicio. El modelo se serializa con `pickle` y se carga al arrancar el ML service.

### 7.3 Resultados

Evaluación con split 80/20 estratificado por clase (`stratify`), semilla fija:

| Métrica        | Valor     |
| -------------- | --------- |
| Accuracy       | **0.886** |
| Macro F1       | **0.892** |
| F1 clase `ham` | **0.94**  |

Los errores restantes se concentran entre `spam` y `smishing`, las clases más parecidas entre sí.

### 7.4 El modelo como microservicio aislado

1. **Backend:** al recibir el mensaje genera un JWT de servicio (60 s) y llama al ML service vía `httpx`: `POST /predict` con `{ "message": ... }`.
2. **ML service:** valida firma, issuer, audience y subject; ejecuta el pipeline y regresa `{ "label": "ham" | "spam" | "smishing" }`.
3. **Resiliencia:** si el ML falla o excede el timeout (5 s), el mensaje se guarda como `unclassified`: el chat nunca se bloquea por el modelo.
4. **Escalamiento independiente:** el servicio de inferencia puede escalar o actualizarse (nuevo `.pkl`) sin tocar backend ni frontend.
5. **Superficie de ataque aislada:** el ML service solo acepta tokens del backend, jamás tráfico directo de usuarios.

**Endpoint del ML service:**

```jsonc
// POST /predict   (Authorization: Bearer <jwt-de-servicio>)
// request
{ "message": "verify your bank account" }
// response
{ "label": "smishing" }
```

Devuelve `401` si falta el token de servicio o no es válido.

---

## 8. Integración: vida de un mensaje (end-to-end)

1. **Envío** — el emisor escribe y el frontend hace `POST /v1/messages` con su JWT.
2. **Clasificación** — el backend pide la predicción al ML service con un JWT de servicio de 60 s.
3. **Persistencia** — el mensaje se guarda en PostgreSQL con su `classification_label`.
4. **Push** — se emite `message_created` por WebSocket al destinatario conectado.
5. **Alerta visual** — el destinatario ve el mensaje con su badge: `ham`, `spam` o `smishing`.

La clasificación ocurre dentro del mismo request de envío; el destinatario recibe el mensaje ya etiquetado, sin estados intermedios visibles.

---

## 9. Red: topología física

```
   Red Tec (Internet)
          │   solo puertos 443 (HTTPS) y 22 (SSH) expuestos
          ▼
     ┌─────────┐   PAT: reparte la salida a internet
     │ Router  │   a toda la subred privada
     └────┬────┘
          │
   ┌──────┴──────┐
   │             │
┌──────┐     ┌──────┐
│Switch│     │Switch│
│  1   │     │  2   │
└──┬───┘     └──┬───┘
   │            │
   ▼            ▼
   Nube OpenStack (laboratorio)
   Red infraestructura 3 · 172.20.70.0/24 · VLAN 3
   (p. ej. servidor backend/ML en 172.20.70.2)
```

- **PAT en el router:** reparte la salida a internet a toda la subred privada.
- Hacia la red del Tec solo se exponen los puertos `443` (HTTPS) y `22` (SSH).
- La VLAN 3 conecta las premisas físicas con la nube OpenStack del laboratorio.

---

## 10. Nube: despliegue en OpenStack

El sistema se despliega sobre **5 instancias activas** en OpenStack (más una réplica de backend prevista para crecimiento):

| Instancia      | Rol                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend-gjm` | nginx sirve el build estático de Vite (SPA fallback con `try_files`).                                                                       |
| `lb-gjm`       | nginx como load balancer L7 hacia los backends (hoy solo `backend1-gjm` en rotación).                                                       |
| `backend1-gjm` | FastAPI como servicio systemd (`Restart=always`).                                                                                           |
| `db-gjm`       | PostgreSQL dedicado; acceso solo desde el CIDR de los backends.                                                                             |
| `jump-server`  | Único punto de administración SSH de toda la red.                                                                                           |
| `backend2-gjm` | Réplica idéntica para redundancia activa-activa. **No levantada** (falta de cupo de instancias); el LB ya está preparado para incorporarla. |

**Diseño escalable, seguro y redundante:** el LB permite agregar más backends sin tocar el frontend; los security groups restringen cada capa (SSH solo desde dentro de la red, Postgres solo desde los backends); la caída de un backend no tira el servicio.

### Direccionamiento real (red `172.20.70.0/24`, VLAN 3)

Valores tomados de los `cloud-init` en [`cloud/`](./cloud/):

| Componente                                | Dirección       | Puerto   |
| ----------------------------------------- | --------------- | -------- |
| frontend-gjm (SPA, origen CORS permitido) | `172.20.70.191` | 80 / 443 |
| backend1-gjm (FastAPI)                    | `172.20.70.171` | 8000     |
| db-gjm (PostgreSQL)                       | `172.20.70.156` | 5432     |
| ML service                                | `172.20.70.2`   | 8001     |
| lb-gjm (load balancer)                    | `172.20.70.180` | 80 / 443 |
| jump-server (administración SSH)          | `172.20.70.187` | 22       |

### Instancias en OpenStack (proyecto `infra3`)

Instancias del equipo, todas con flavor `tiny` y estado Active / Running. Las del proyecto terminan en `-gjm`; `jump-server` es el bastión SSH de administración:

| Instancia      | IP              | Rol                                       |
| -------------- | --------------- | ----------------------------------------- |
| `lb-gjm`       | `172.20.70.180` | Load balancer nginx (TLS + rate limiting) |
| `backend1-gjm` | `172.20.70.171` | Backend FastAPI (systemd)                 |
| `db-gjm`       | `172.20.70.156` | PostgreSQL                                |
| `frontend-gjm` | `172.20.70.191` | SPA servida por nginx                     |
| `jump-server`  | `172.20.70.187` | Bastión SSH de administración             |

![Instancias del proyecto en OpenStack (panel infra3)](docs/img/instancias-infra3.jpeg)

---

## 11. Configuraciones: infraestructura como código

### 11.1 Aprovisionamiento con cloud-init

Los scripts viven en [`cloud/`](./cloud/). Cada instancia se levanta pegando su `cloud-init` (cero configuración manual):

| Script (en `cloud/`)                          | Qué hace                                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gjm-front-cloud-init.txt`                    | Instala Node 20 + nginx, clona el repo, ejecuta `npm ci && npm run build` y publica `dist/` en `/var/www/html` (con SPA fallback `try_files`).        |
| `gjm-back1-cloud-init.txt`                    | Instala `uv`, clona el repo, escribe `/etc/itchat/backend.env` y registra `itchat-backend.service` en systemd (`Restart=always`, `RestartSec=5`).     |
| `gjm-db-cloud-init.txt`                       | Instala PostgreSQL, habilita `listen_addresses='*'`, añade a `pg_hba.conf` la regla del CIDR de backends con `scram-sha-256` y crea la base `itchat`. |
| `gjm-lb-cloud-init.txt` + `gjm-lb-nginx.conf` | Despliega el nginx balanceador con el upstream de los backends.                                                                                       |

El ML service corre en `172.20.70.2:8001` y no tiene cloud-init dedicado en el repo. Tampoco existe `gjm-back2-cloud-init` porque `backend2-gjm` aún no se levanta.

- **Secretos fuera del repo:** los valores sensibles y dependientes del entorno están redactados como placeholders `__...__` que se inyectan al desplegar — entre ellos `__JWT_SECRET_KEY__`, `__ML_SERVICE_JWT_SECRET_KEY__`, `__DB_PASSWORD__`, `__SYSTEM_PASSWORD__`, `__TLS_CERT_FILE__`, `__TLS_KEY_FILE__`, `__LB_PUBLIC_HOST__`, `__LB_PUBLIC_URL__`, `__LB_WS_URL__` y `__BACK_SUBNET_CIDR__`. Ningún secreto queda versionado en el repositorio.
- **Auto-recuperación:** systemd reinicia el backend ante cualquier caída (`RestartSec=5`).
- **TLS y secreto de servicio:** el `cloud-init` del LB sirve HTTPS (`listen 443 ssl` con `ssl_certificate`/`ssl_certificate_key`) y `backend.env` fija `ML_SERVICE_JWT_SECRET_KEY` para que backend y ML service compartan un secreto explícito, no el valor por defecto.

### 11.2 Load balancer nginx (alta disponibilidad)

Archivo real: [`cloud/gjm-lb-nginx.conf`](./cloud/gjm-lb-nginx.conf), desplegado como `/etc/nginx/conf.d/itchat.conf`.

```nginx
# anti-DDoS (contexto http): límite de tasa y de conexiones por IP
limit_req_zone  $binary_remote_addr zone=api:10m  rate=10r/s;
limit_conn_zone $binary_remote_addr zone=conn:10m;

upstream itchat_backend {
    least_conn;
    server 172.20.70.171:8000 max_fails=3 fail_timeout=30s;
    # server 172.20.70.<back2>:8000 max_fails=3 fail_timeout=30s;  # al levantar backend2-gjm
    keepalive 32;
}

location /v1/ws {                       # WebSockets de larga vida
    proxy_pass http://itchat_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

- **`least_conn`:** cada request va al backend con menos conexiones activas; mejor que round-robin con WebSockets de larga vida.
- **Health checks pasivos:** tras 3 fallos, el backend sale de rotación 30 s (`max_fails=3 fail_timeout=30s`). `/health` (sin auth) permite sondear el estado.
- **WebSockets de larga vida:** upgrade de protocolo en `/v1/ws` con `proxy_read_timeout` de 1 h para no cortar sockets activos.
- **`keepalive 32`:** reutiliza conexiones LB→backend, reduciendo latencia por handshake.
- **Escalar es descomentar:** agregar `backend2-gjm` es habilitar una línea `server` más en el upstream; el frontend no cambia.
- **TLS / HTTPS:** el LB termina TLS con certificados HTTPS; hacia la red del Tec el tráfico viaja por `443`.
- **Rate limiting (anti-DDoS):** las zonas `api` (10 req/s por IP) y `conn` (conexiones concurrentes por IP) se aplican con `limit_req` / `limit_conn` en los `location`, mitigando floods y abuso volumétrico básico.

---

## 12. Pruebas realizadas

### Backend · pytest

**15 pruebas automatizadas**, todas en verde. Corren con SQLite en memoria y un stub del modelo: no requieren PostgreSQL ni el `.pkl`. Cubren autenticación, conversaciones, mensajes, el contrato con el ML service y el flujo en tiempo real, entre ellas:

- Registro y login (token + usuario; rechazo de duplicados; credenciales inválidas).
- Creación/recuperación de chats directos y listado solo de las conversaciones del usuario.
- Orden de conversaciones por último mensaje y búsqueda de usuarios (excluye al propio).
- Persistencia del mensaje con su `classification_label`; bloqueo de envío a conversaciones ajenas.
- WebSocket: el destinatario autenticado recibe `message_created`; rechazo de token inválido; un destinatario offline no rompe el envío.
- Consistencia HTTP-enviado / WS-recibido / historial recargado.
- Fallback a `unclassified` cuando el ML service no está disponible.

```bash
cd backend && uv run pytest    # 15 passed
```

### ML service · pytest

**7 pruebas automatizadas**, todas en verde:

- `/predict` devuelve la etiqueta y exige token de servicio válido.
- Verificación del token de servicio (firma, issuer, audience, subject).
- Carga del artefacto `.pkl` y error claro si el modelo no existe.
- `FeatureBuilder`: reemplazo de patrones sensibles (URL/email/teléfono) y columnas de features esperadas.

```bash
cd ml-service && uv run pytest  # 7 passed
```

### Modelo · evaluación formal

- Split 80/20 estratificado por clase.
- `classification_report` y matrices de confusión por modelo.
- Pruebas con mensajes nuevos fuera del dataset (sanity check).

### Infraestructura · end-to-end

- Health checks del LB contra `/health` de cada backend.
- Conectividad SSH por la cadena: laptop → PAT → jump server → instancias.
- Flujo completo verificado en vivo: login, chat y clasificación.

---

## 13. Cómo correr el proyecto en local

Resumen (guía detallada en el [README](./README.md)). Orden: **PostgreSQL → ml-service → backend → frontend**.

```bash
# 0. PostgreSQL (opción rápida con Docker)
docker run -d --name itchat-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# 1. ML service (puerto 8001)
cd ml-service && uv sync --group dev && cp .env.example .env
uv run train-sms-model   # genera data/models/sms_linear_svm.pkl (una sola vez)
uv run main

# 2. Backend (puerto 8000)
cd backend && uv sync --group dev && cp .env.example .env
uv run main

# 3. Frontend (puerto 5173)
cd frontend && npm install && cp .env.example .env
npm run dev
```

> El secreto JWT de servicio debe coincidir: `ML_SERVICE_JWT_SECRET_KEY` (backend) = `SERVICE_JWT_SECRET_KEY` (ml-service). Los `.env.example` ya vienen alineados para desarrollo local.

**Requisitos:** Python 3.11+, `uv`, PostgreSQL 14+, Node.js 18+.

---

## 14. Variables de entorno

### backend (`backend/.env`)

| Variable                                           | Descripción                                    | Por defecto                                                       |
| -------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                                     | Conexión a PostgreSQL                          | `postgresql+psycopg://postgres:postgres@localhost:5432/itchat`    |
| `JWT_SECRET_KEY`                                   | Clave para firmar JWT de usuario               | `change-this-secret-before-production`                            |
| `JWT_ALGORITHM` / `JWT_EXPIRE_MINUTES`             | Algoritmo y duración del token                 | `HS256` / `60`                                                    |
| `ML_SERVICE_URL`                                   | URL base del ML service                        | `http://127.0.0.1:8001`                                           |
| `ML_SERVICE_PREDICT_PATH`                          | Ruta del endpoint de predicción                | `/predict`                                                        |
| `ML_SERVICE_TIMEOUT_SECONDS`                       | Timeout de la llamada HTTP al ML               | `5`                                                               |
| `ML_SERVICE_JWT_SECRET_KEY`                        | Secreto compartido backend ↔ ML                | `change-before-prod`                                              |
| `ML_SERVICE_JWT_ISSUER` / `_AUDIENCE` / `_SUBJECT` | Claims del token de servicio                   | `itchat-backend` / `itchat-ml-service` / `itchat-backend-service` |
| `ML_SERVICE_JWT_EXPIRE_SECONDS`                    | Expiración corta del token de servicio         | `60`                                                              |
| `UNCLASSIFIED_LABEL`                               | Etiqueta de respaldo si la clasificación falla | `unclassified`                                                    |
| `CORS_ALLOW_ORIGINS`                               | Orígenes permitidos (CSV)                      | `http://localhost:5173,http://127.0.0.1:5173`                     |
| `HOST` / `PORT`                                    | Host y puerto de Uvicorn                       | `127.0.0.1` / `8000`                                              |
| `TLS_CERT_FILE` / `TLS_KEY_FILE`                   | Certificado y llave TLS (opcional)             | —                                                                 |

### ml-service (`ml-service/.env`)

| Variable                                        | Descripción                                | Por defecto                                                       |
| ----------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `MODEL_PATH`                                    | Ruta del artefacto `.pkl`                  | `data/models/sms_linear_svm.pkl`                                  |
| `DATASET_PATH`                                  | Ruta del dataset CSV de entrenamiento      | `data/dataset.csv`                                                |
| `SERVICE_JWT_SECRET_KEY`                        | Secreto compartido para validar al backend | `change-before-prod`                                              |
| `SERVICE_JWT_ALGORITHM`                         | Algoritmo del token de servicio            | `HS256`                                                           |
| `SERVICE_JWT_ISSUER` / `_AUDIENCE` / `_SUBJECT` | Claims esperados del backend               | `itchat-backend` / `itchat-ml-service` / `itchat-backend-service` |
| `HOST` / `PORT`                                 | Host y puerto del servicio                 | `127.0.0.1` / `8001`                                              |
| `TLS_CERT_FILE` / `TLS_KEY_FILE`                | Certificado y llave TLS (opcional)         | —                                                                 |

### frontend (`frontend/.env`)

| Variable              | Descripción                                         | Por defecto             |
| --------------------- | --------------------------------------------------- | ----------------------- |
| `VITE_API_URL`        | URL base del backend (vacío = usa el proxy de Vite) | _(vacío)_               |
| `VITE_WS_URL`         | URL del WebSocket (vacío = usa el proxy de Vite)    | _(vacío)_               |
| `VITE_BACKEND_TARGET` | Destino del proxy de Vite hacia el backend          | `http://127.0.0.1:8000` |

---

## 15. Dependencias principales

### Backend / ML service (Python)

| Paquete             | Rol                                                    |
| ------------------- | ------------------------------------------------------ |
| `fastapi`           | Framework web async (rutas, validación, OpenAPI)       |
| `uvicorn[standard]` | Servidor ASGI con soporte WebSocket                    |
| `sqlalchemy`        | ORM async (modelos + queries)                          |
| `psycopg`           | Driver async para PostgreSQL                           |
| `aiosqlite`         | Driver async para SQLite (tests)                       |
| `pyjwt`             | Generación y validación de JWT (usuario y de servicio) |
| `httpx`             | Cliente HTTP del backend hacia el ML service           |
| `python-dotenv`     | Carga de variables desde `.env`                        |
| `scikit-learn`      | Pipeline ML (TF-IDF, LinearSVC, MaxAbsScaler)          |
| `pandas`            | Carga del dataset y manipulación de datos              |

### Frontend (Node.js)

| Paquete                | Rol                         |
| ---------------------- | --------------------------- |
| `react` + `react-dom`  | UI declarativa              |
| `vite`                 | Build tool y dev server     |
| `typescript`           | Tipado estático             |
| `@vitejs/plugin-react` | Soporte JSX/React para Vite |

---

## 16. Conclusiones y trabajo futuro

**Sistema completo y funcional:** de la UI al fierro — SPA, API, ML, base de datos, VLAN propia y despliegue automatizado en OpenStack. ML honesto y explicable (Linear SVM, macro F1 0.892 sobre 19,417 mensajes reales). Seguridad en cada capa (PBKDF2, doble JWT, `scram-sha-256`, security groups y un único punto de entrada SSH). Listo para crecer: backends redundantes tras un LB y aprovisionamiento por cloud-init.

**Trabajo futuro:**

- Migraciones formales de BD (Alembic) en lugar del `create_all` automático.
- Distinguir mejor `spam` vs `smishing` (subtipos, embeddings).
- Creación de chats en grupo.
- Modelo de reconocimiento de imágenes sensibles.
- Reentrenamiento periódico con mensajes reportados.
- Levantar la segunda instancia de backend (`backend2-gjm`) tras el load balancer.
