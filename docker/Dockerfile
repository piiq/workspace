# syntax=docker/dockerfile:1

FROM node:22-slim AS frontend-build
ARG BUN_VERSION=1.4.4
ENV NODE_OPTIONS="--max-old-space-size=4608"
RUN apt-get update && apt-get install --no-install-recommends -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global bun@${BUN_VERSION}
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
COPY packages/plugin-sdk/ /app/packages/plugin-sdk/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY frontend/ ./
RUN --mount=type=bind,target=/context \
    if [ -d /context/.build/plugins ]; then \
      mkdir -p /app/.build && cp -R /context/.build/plugins /app/.build/plugins; \
    fi && bun run build:runtime

FROM python:3.13-slim AS python-base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH="/opt/.venv/bin:$PATH"

FROM python-base AS backend-build
ARG POETRY_VERSION=2.5.1
RUN apt-get update && apt-get install --no-install-recommends -y build-essential git \
    && rm -rf /var/lib/apt/lists/*
RUN --mount=type=cache,target=/root/.cache/pip pip install poetry==${POETRY_VERSION}
ENV POETRY_VIRTUALENVS_IN_PROJECT=true POETRY_NO_INTERACTION=1
WORKDIR /opt
COPY backend/pyproject.toml backend/poetry.lock ./
RUN --mount=type=cache,target=/root/.cache/pypoetry poetry install --only main

FROM nginx:stable-alpine AS frontend
RUN apk add --no-cache bash
ENV NGINX_PORT=80 BACKEND_UPSTREAM=backend:8000
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 scripts/render-frontend-config.sh /docker-entrypoint.d/40-render-frontend-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM python-base AS backend
RUN useradd --create-home appuser && mkdir -p /data/storage \
    && chown -R appuser:appuser /data
COPY --from=backend-build /opt/.venv /opt/.venv
WORKDIR /opt/code
COPY --chown=appuser:appuser backend/ ./
COPY --chown=appuser:appuser admin_cli/ /opt/admin_cli/
COPY --chmod=755 docker/backend/entrypoint.sh /usr/local/bin/workspace-backend
RUN ln -s /opt/admin_cli/openbb-admin /usr/local/bin/openbb-admin \
    && chown appuser:appuser /opt/code
ENV MODE=onprem USER_CREATE_PATH=/data/user_create.json
USER appuser
EXPOSE 8000
ENTRYPOINT ["workspace-backend"]
CMD ["api"]
