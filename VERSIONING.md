# PickAndSync versioning

## Every code change

- Commit changes with a short, meaningful message. A commit is a saved snapshot in Git history.
- Push the branch to GitHub. The pushed commit and its history are then backed up on GitHub.
- Merge work into `main` through a pull request. Each push to `main` automatically creates a GitHub Release named `snapshot-<run>-<commit>`, with generated notes and a tag pointing to that exact source snapshot.
- Feature branch pushes stay in the branch's commit history; they become a published snapshot release when merged and pushed to `main`.

## Customer and Host app releases

Git source snapshots are separate from Android store versions. Bump these only when preparing a new Android app build:

| App | Expo version | Android package | Android version code |
| --- | --- | --- | --- |
| Customer | `apps/mobile/app.json` | `com.packandsync.app` | `apps/mobile/app.json` → `android.versionCode` |
| Host | `apps/host-mobile/app.json` | `com.pickandsync.host` | `apps/host-mobile/app.json` → `android.versionCode` |

Keep each Expo `version` in sync with that app's `package.json` version. Android `versionCode` must increase for every Play Store upload of that app. Website and backend changes do not consume Android version codes.

## Restoring a source snapshot

Open the repository's **Releases** page, select a `snapshot-*` release, and use its tag to inspect or check out the exact source state. Do not edit an existing tag; a later change should create a new commit and a new snapshot.
