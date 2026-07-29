# PackAndSync API — for Render / Railway / any Docker host
FROM node:20-bookworm-slim

WORKDIR /app

# OpenSSL for Prisma engines
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Root workspace manifests (monorepo)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

RUN npm ci --workspace=backend --include-workspace-root

COPY backend ./backend

WORKDIR /app/backend

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Migrate then start (DATABASE_URL must be set in the host)
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
