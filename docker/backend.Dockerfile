# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /srv
COPY ai/pyproject.toml ai/pyproject.toml
COPY backend/pyproject.toml backend/pyproject.toml
COPY ai/jewelora_ai ai/jewelora_ai
COPY backend/app backend/app
COPY backend/alembic backend/alembic
COPY backend/alembic.ini backend/alembic.ini
COPY database database
COPY scripts/download_models.sh scripts/download_models.sh

RUN cd backend && uv venv /opt/venv -p 3.12 && uv pip install -p /opt/venv/bin/python -e . -e ../ai
RUN AI_MODELS_DIR=/srv/ai/models bash scripts/download_models.sh

ENV PATH="/opt/venv/bin:$PATH" AI_MODELS_DIR=/srv/ai/models STORAGE_LOCAL_ROOT=/data/storage
# Only trust X-Forwarded-* from the private docker network (nginx). Override per deployment.
ENV FORWARDED_ALLOW_IPS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
RUN useradd -r -u 10001 jewelora && mkdir -p /data/storage && chown -R jewelora /data /srv
USER jewelora
WORKDIR /srv/backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
