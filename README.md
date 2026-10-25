# KILLTOY releases

Ready-to-run Mac builds of KILLTOY (it was called PURP until build 10), Eman's vocal-recording app. The app's code lives in a private repo; this public repo only holds the builds.

- **First time:** download `KILLTOY-mac.zip` from the [latest release](https://github.com/abrutebeauty/PURP-releases/releases/latest), unzip it, drag KILLTOY into Applications, then right-click KILLTOY and choose Open (needed once, because the app isn't signed with an Apple certificate yet).
- **After that:** KILLTOY checks here by itself and shows "Restart to update" when a new build is ready. No more downloading.
- `PURP-mac.zip` in each release is the same app under its old name. The in-app updater downloads that one, so older PURP builds can still update; the app renames itself to KILLTOY after its first run.

Each release is tagged `build-<number>` and is published automatically by the Mac build in the code repo.
