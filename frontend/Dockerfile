FROM node:22 AS builder

ENV NODE_OPTIONS="--max-old-space-size=4608"

RUN npm install -g bun

WORKDIR /app
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ .
RUN bun run build:runtime

FROM nginx:stable

ENV NGINX_PORT=80

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE ${NGINX_PORT}
CMD ["nginx", "-g", "daemon off;"]
