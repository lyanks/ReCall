# One image = one deploy (modular monolith): build the React app, then serve it from FastAPI.

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Firebase web config comes from frontend/.env.production (public values).
RUN npm run build

FROM python:3.12-slim
WORKDIR /srv/backend
ENV PYTHONUNBUFFERED=1 STATIC_DIR=/srv/static
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist /srv/static
EXPOSE 8000
# Apply migrations, then start the API. PORT is set by the host (Render/Railway/Fly/Cloud Run).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
