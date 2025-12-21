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
EXPOSE 8080
CMD ["node", "backend/src/server.js"]
