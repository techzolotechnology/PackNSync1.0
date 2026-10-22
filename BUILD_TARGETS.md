# PickAndSync Build Targets

This repo has four client targets:

- Website: existing Vite app in `frontend`
- Android/Web mobile app: Expo React Native app in `apps/mobile`
- Car host app: separate Expo app in `apps/host-mobile` (see its README for backend prerequisites)
- Windows desktop app: Electron wrapper in `desktop`

## Install

Host app: `npm run dev:host`, `npm run build:host:web`, or `npm run build:host:apk` from the repository root.

```powershell
npm install
```

## Website

```powershell
npm run build:frontend
npm run dev:frontend
```

## Android APK

Expo/EAS is configured for an APK preview build.

```powershell
npm run dev:mobile
npm run build:android:apk
```

Requirements:

- Expo/EAS account
- Android package configured in `apps/mobile/app.json`
- The deployed common API is used automatically

## Desktop EXE

```powershell
npm run build:desktop:exe
```

Output goes to `desktop/release`.

## Backend

Website, Android, Expo web, and desktop all default to the common deployed API at `https://api.pickandsync.com/api`. Local website development reaches it through Vite's same-origin proxy. For deliberate local-backend testing, set `VITE_DEV_BACKEND_ORIGIN`; build-time client overrides remain available through `VITE_API_URL`/`VITE_SOCKET_URL` or `EXPO_PUBLIC_API_URL`.
