# ---- Build-Stage ----
# python3/make/g++ werden nur gebraucht, falls better-sqlite3 kein
# vorkompiliertes Binary für Alpine (musl) findet und selbst kompiliert.
FROM node:22-alpine AS build

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npm prune --omit=dev

# ---- Runtime-Stage ----
FROM node:22-alpine

# Verknüpft das GHCR-Package mit dem GitHub-Repository
LABEL org.opencontainers.image.source="https://github.com/SirTobyB/LebensmittelKumpel"

WORKDIR /app

# node_modules bleibt nötig: better-sqlite3 (natives Modul) kann nicht
# in den adapter-node-Build gebündelt werden.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Drizzle-Migrationen werden beim App-Start angewendet
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./

ENV NODE_ENV=production
ENV DATABASE_URL=/data/lebensmittelkumpel.db
ENV DATA_DIR=/data
ENV PORT=3000

VOLUME /data
EXPOSE 3000

CMD ["node", "build"]
