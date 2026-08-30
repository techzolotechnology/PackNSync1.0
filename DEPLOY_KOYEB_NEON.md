# Deploy PickAndSync Backend on Koyeb + Neon

This replaces the suspended Render backend with:

- Koyeb: Node/Express web service
- Neon: PostgreSQL database

## 1. Create the Neon database

1. Open https://console.neon.tech/
2. Create a new project, for example `packandsync`.
3. Copy two connection strings:
   - Pooled connection string: use this as `DATABASE_URL`.
   - Direct connection string: use this as `DIRECT_URL`.

For Prisma, keep `sslmode=require` on both URLs.

## 2. Create the Koyeb web service

1. Open https://app.koyeb.com/
2. Create a Web Service.
3. Choose GitHub deployment.
4. Select `techzolotechnology/PackNSync1.0`.
5. Branch: `main`.
6. Builder: Dockerfile.
7. Dockerfile path: `Dockerfile.koyeb`.
8. Exposed port: `3001`.
9. Health check path: `/health`.

Koyeb provides `PORT` automatically, but this app also works with `PORT=3001`.

## 3. Add Koyeb environment variables

Use `backend/.env.koyeb.example` as the checklist. Required values:

```text
NODE_ENV=production
PORT=3001
DATABASE_URL=<Neon pooled connection string>
DIRECT_URL=<Neon direct connection string>
JWT_SECRET=<long random secret>
JWT_REFRESH_SECRET=<different long random secret>
COOKIE_SAMESITE=none
FRONTEND_URL=https://pickandsync.com
FRONTEND_URLS=https://pickandsync.com,https://www.pickandsync.com,https://techzolotechnology.github.io
API_PUBLIC_URL=https://YOUR-KOYEB-APP.YOUR-KOYEB-ORG.koyeb.app
```

For first deployment/testing, you can set:

```text
OTP_CONSOLE_FALLBACK=true
```

That lets OTPs print in Koyeb logs. For real users, configure SMTP or SMS and remove the fallback.

## 4. Deploy and verify

After Koyeb finishes building, open:

```text
https://YOUR-KOYEB-APP.YOUR-KOYEB-ORG.koyeb.app/health
```

Expected response:

```json
{ "status": "ok" }
```

The container startup command runs:

```text
npx prisma migrate deploy
node prisma/seedShowcase.js
node src/index.js
```

So Neon will receive the Prisma schema automatically on first boot.

## 5. Point the frontend at Koyeb

Update GitHub Pages build settings or local build env:

```text
VITE_API_URL=https://YOUR-KOYEB-APP.YOUR-KOYEB-ORG.koyeb.app/api
VITE_SOCKET_URL=https://YOUR-KOYEB-APP.YOUR-KOYEB-ORG.koyeb.app
```

Then rebuild and redeploy the frontend. Until this is changed, the frontend still calls the old Render API.

## 6. Optional cleanup

Once Koyeb works:

1. Remove or ignore the old Render service.
2. Rotate any secrets that were copied from Render.
3. Keep `FRONTEND_URLS` in Koyeb synced with every frontend domain you use.
