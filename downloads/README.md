# Download Artifacts

Generated installers for the website Download menu:

| File | Source |
|------|--------|
| `PickAndSync-Android.apk` | Expo / React Native release build (`apps/mobile`) |
| `PickAndSync-Windows-Setup.exe` | Electron NSIS installer (`desktop`) |

## Rebuild

```bash
# Windows
npm run build:frontend
npm run build --workspace=desktop
copy desktop\release\"PickAndSync Setup 1.0.0.exe" frontend\public\downloads\PickAndSync-Windows-Setup.exe

# Android (JDK 17 + ANDROID_HOME required)
cd apps/mobile
npx expo prebuild --platform android
cd android
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.16.8-hotspot
set GRADLE_USER_HOME=C:\g
gradlew.bat assembleRelease
copy app\build\outputs\apk\release\app-release.apk ..\..\..\frontend\public\downloads\PickAndSync-Android.apk
```

These binaries are gitignored (large). Keep them in `frontend/public/downloads/` for local/dev downloads to work.
