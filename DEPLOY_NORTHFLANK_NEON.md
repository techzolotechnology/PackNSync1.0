# Deploy PickAndSync Backend on Northflank + Neon

This is the recommended replacement for the suspended Render backend.

- Northflank runs the Node/Express API from Docker.
- Neon hosts PostgreSQL.

## 1. Create the Neon database

1. Open https://console.neon.tech/
2. Create a project named something like `packandsync`.
3. Copy both connection strings:
   - Pooled connection string: use as `DATABASE_URL`.
   - Direct connection string: use as `DIRECT_URL`.

Both URLs should include `sslmode=require`.

## 2. Create a Northflank project

1. Open https://app.northflank.com/
2. Choose the **Developer Sandbox** plan if it is available.
3. Create a project, for example `packandsync`.

## 3. Create the backend service

1. Click **Create New** or **New Service**.
2. Choose a combined **Build and Deployment Service** from a Git repository.
3. Connect GitHub.
4. Select:

```text
Repository: techzolotechnology/PackNSync1.0
Branch: main
Build type: Dockerfile
Build context: /
Dockerfile path: /Dockerfile.northflank
```

Northflank can detect the exposed Dockerfile port, but configure it explicitly if asked:

```text
Port: 3001
Protocol: HTTP
Public: enabled
Health check path: /health
```

## 4. Add runtime environment variables

Use `backend/.env.northflank.example` as the checklist.

Minimum required values:

```text
NODE_ENV=production
PORT=3001
DATABASE_URL=<Neon pooled connection string>
DIRECT_URL=<Neon direct connection string>
JWT_SECRET=<long random secret>
JWT_REFRESH_SECRET=<different long random secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SAMESITE=none
FRONTEND_URL=https://pickandsync.com
FRONTEND_URLS=https://pickandsync.com,https://www.pickandsync.com,https://techzolotechnology.github.io
API_PUBLIC_URL=https://YOUR-NORTHFLANK-SERVICE-CODE.northflank.app
OTP_CONSOLE_FALLBACK=true
```

`OTP_CONSOLE_FALLBACK=true` is only for testing. OTP codes will print in Northflank logs. For real users, configure SMTP or SMS and remove that fallback.

## 5. Deploy and verify

Deploy the service, then open:

```text
https://YOUR-NORTHFLANK-SERVICE-CODE.northflank.app/health
```

Expected response:

```json
{ "status": "ok" }
```

On startup the container runs:

```text
npx prisma migrate deploy
node prisma/seedShowcase.js
node src/index.js
```

That applies the database schema to Neon automatically.

## 6. Point the frontend to Northflank

After the backend URL works, rebuild the GitHub Pages frontend with:

```text
VITE_API_URL=https://YOUR-NORTHFLANK-SERVICE-CODE.northflank.app/api
VITE_SOCKET_URL=https://YOUR-NORTHFLANK-SERVICE-CODE.northflank.app
```

Until this is changed, the hosted frontend will still call the old Render URL.

## 7. Common issues

- **Build fails at Prisma generate**: confirm the service is using `/Dockerfile.northflank`.
- **Health check fails**: confirm the public port is `3001` and health path is `/health`.
- **Register/Login says API unreachable**: confirm the frontend has been rebuilt with the Northflank URL and `FRONTEND_URLS` includes your frontend domains.
- **OTP not received**: with `OTP_CONSOLE_FALLBACK=true`, read the OTP in Northflank logs. Configure `SMTP_PASS` or SMS keys before production use.
