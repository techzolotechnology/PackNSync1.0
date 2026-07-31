# PackAndSync API — for Render / Railway / any Docker host
FROM node:20-bookworm-slim

WORKDIR /app

# OpenSSL for Prisma engines
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Root lockfile + all workspace package.json files (npm workspaces requires every member)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY apps/mobile/package.json ./apps/mobile/
COPY desktop/package.json ./desktop/

# Schema needed if any install script touches Prisma; we skip scripts and generate later
COPY backend/prisma ./backend/prisma

# Ignore lifecycle scripts during install (root postinstall needs full tree)
RUN npm ci --workspace=backend --include-workspace-root --omit=dev --ignore-scripts

COPY backend ./backend

WORKDIR /app/backend

RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Migrate, top up showcase content while the platform is still empty, then start.
# The seed is additive and must never keep the API from booting.
CMD ["sh", "-c", "npx prisma migrate deploy && { node prisma/seedShowcase.js --only-if-empty || echo 'showcase seed skipped'; } && node src/index.js"]
