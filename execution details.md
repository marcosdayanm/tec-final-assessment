# Execution Details

## Current state

The repository contains two main applications:

- `backend/`: FastAPI API with PostgreSQL, async SQLAlchemy, JWT, and WebSocket support.
- `frontend/`: Vite + React client connected to the real backend.

## Backend

### Stack

- FastAPI
- Async SQLAlchemy with `AsyncSession`
- PostgreSQL with `psycopg`
- Uvicorn with WebSocket support via `uvicorn[standard]`
- SMS classification model loaded from `backend/data/models/sms_linear_svm.pkl`

### Active endpoints

- `POST /v1/register`
- `POST /v1/login`
- `GET /v1/users/search`
- `GET /v1/conversations`
- `POST /v1/conversations/direct/{target_user_id}`
- `GET /v1/direct_messages/{conversation_id}`
- `POST /v1/messages`
- `GET /v1/ws?token=<jwt>`

### Important operational details

- The backend attempts to create the PostgreSQL database automatically on startup if it does not exist.
- It then creates the schema tables automatically.
- For WebSocket support to work, the backend environment must have the dependencies from `uvicorn[standard]`.
- CORS is enabled for:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

### Start backend

```bash
cd backend
uv sync --group dev
uv run main
```

### Backend verification

Latest known verification:

```bash
uv run --directory backend pytest
```

Expected result:

- `17 passed`

## Frontend

### Stack

- Vite
- React
- TypeScript

### Current backend integration

The frontend currently consumes:

- login
- register
- conversation list
- message history
- user search
- direct conversation creation
- message sending
- realtime message reception via WebSocket

### Current flow

- `App.tsx` stores the session in `localStorage`.
- `Login.tsx` supports both sign-in and registration.
- `Dashboard.tsx` orchestrates conversation loading, user search, and message history.
- `ChatWindow.tsx` only renders and sends messages.
- `useRealtimeMessages.ts` maintains a single WebSocket connection per authenticated user.

### Risk labels

In the frontend:

- `spam` shows a visible warning.
- `smishing` shows a visible warning.
- `ham` does not show a warning badge.

### Start frontend

```bash
cd frontend
npm install
npm run dev
```

### Vite proxy

`frontend/vite.config.ts` already proxies:

- `/v1`
- `/health`

to:

- `http://127.0.0.1:8000`

## Key files

### Backend

- `backend/src/app.py`
- `backend/src/db.py`
- `backend/src/chat.py`
- `backend/src/schemas.py`
- `backend/pyproject.toml`

### Frontend

- `frontend/src/api/chat.ts`
- `frontend/src/hooks/useRealtimeMessages.ts`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/ChatWindow.tsx`
- `frontend/src/components/Message.tsx`

## Issues already resolved

- Migration to async SQLAlchemy.
- WebSocket support in the backend.
- `404` errors on `/v1/ws` caused by missing WebSocket library support in Uvicorn.
- Vite proxy errors such as `ECONNRESET` and `EPIPE` derived from that issue.
- Real frontend integration against all main backend routes.

## Reasonable remaining risks or pending items

- There are no formal migrations yet; the schema is created with `create_all`.
- There is no advanced WebSocket reconnection strategy in the frontend.
- There are no refresh tokens or renewable session flow.
- The sidebar refreshes conversations with polling; if less polling is desired, the socket usage should be expanded.

## Most recent builds / checks

- `npm run build` in `frontend`: OK
- `uv run --directory backend pytest`: OK

