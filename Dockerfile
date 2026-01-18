# syntax=docker/dockerfile:1.5

FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
COPY shared /app/shared
RUN npm run build

FROM node:22-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY backend/ ./
COPY shared /app/shared

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-build /app/backend /app/backend
COPY --from=frontend-build /app/frontend/dist /app/backend/public/client
COPY shared /app/shared

COPY entrypoint.sh ./

# Start and enable SSH (required for Azure portal SSH console)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		openssh-server \
		iproute2 \
		dnsutils \
		tcpdump \
		curl \
		iputils-ping \
		ca-certificates \
        openssl \
	&& echo "root:Docker!" | chpasswd \
	&& chmod u+x ./entrypoint.sh \
	&& rm -rf /var/lib/apt/lists/*

COPY sshd_config /etc/ssh/sshd_config

EXPOSE 8080 2222

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "backend/src/server.js"]
