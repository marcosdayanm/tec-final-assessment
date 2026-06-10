# AGENTS.md

## Purpose

This repository contains a direct-message chat application with a FastAPI backend and a Vite/React frontend. This file is meant to help future sessions resume work without rebuilding context from scratch.

## Project structure

```text
backend/
  src/
  data/
  tests/
  pyproject.toml
  uv.lock

frontend/
  src/
  package.json
  vite.config.ts
```

## Priorities when continuing

1. Do not break the current frontend/backend integration.
2. Keep the HTTP/WebSocket layer aligned with backend DTOs.
3. Keep database access async.
4. Preserve separation of responsibilities:
   - DTOs / schemas serialize
   - `app.py` defines HTTP/WebSocket wiring
   - `chat.py` holds chat domain queries and operations
   - frontend: `Dashboard` coordinates data, `ChatWindow` presents and sends

## Backend: current conventions

- FastAPI routes under `/v1/...`
- Async SQLAlchemy with `AsyncSession`
- Uvicorn with `uvicorn[standard]`
- JWT bearer auth for HTTP
- JWT via query param for WebSocket
- CORS enabled for local Vite
- Automatic PostgreSQL database creation if missing
- Automatic table creation on startup

## Frontend: current conventions

- `frontend/src/api/chat.ts` is the API access layer
- `frontend/src/hooks/useRealtimeMessages.ts` owns the socket connection
- `frontend/src/types.ts` must stay aligned with real backend responses
- `Dashboard.tsx` is the main state orchestrator
- `ChatWindow.tsx` must not go back to talking to old endpoints or running local prediction logic

## Things that must not be reintroduced

- Old endpoints such as:
  - `/auth/login`
  - `/predict`
  - `/ws/{chatId}`
- Old frontend labels such as:
  - `phishing`
  - `real`
  - `pending`
- Per-conversation WebSocket connections. The current implementation uses one socket per authenticated user.

## Useful commands

### Backend

```bash
cd backend
uv sync --group dev
uv run main
uv run pytest
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

## Minimum validation before closing changes

### If backend was changed

```bash
uv run --directory backend pytest
```

### If frontend was changed

```bash
cd frontend
npm run build
```

## Sensitive points

- The frontend socket depends on the backend running with real WebSocket support.
- If `404` shows up again on `/v1/ws`, first check backend dependencies and whether the process was restarted.
- If any backend schema changes, update `frontend/src/types.ts` and the normalization logic in `Dashboard.tsx`.
- If formal migrations are introduced, revisit the current automatic bootstrap behavior in `backend/src/db.py`.

## Summary of work already completed

- Backend reorganized under `backend/`
- Chat API implemented
- SQLAlchemy migrated to async
- Frontend connected to the real backend
- User search and conversation creation already working
- `spam` and `smishing` labels visible in the UI

## Companion file

See also:

- `execution details.md`

