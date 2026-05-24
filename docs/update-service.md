# Destrall manual update service

Destrall checks [GitHub Releases](https://github.com/rinoco-labs/Destrall/releases) for new desktop builds, downloads the correct installer for the user’s platform, and lets them open it manually. The app never auto-installs, auto-restarts, or removes the current installation.

## How checking works

1. The main process reads the current version from `app.getVersion()` (from `app/package.json`).
2. It queries `https://api.github.com/repos/rinoco-labs/Destrall/releases/latest`.
3. Draft releases are ignored. Prereleases are ignored on the **stable** channel (see `app/src/config/update.ts`).
4. The latest tag is normalized (`v0.1.0` and `0.1.0` compare the same) and compared to the running version.
5. If a newer release exists, the service picks a release asset for the current OS/architecture.
6. The renderer shows availability in **Settings → App updates** and in an optional top banner.

## Expected release asset names

| Platform | Architecture | Preferred asset | Fallback |
|----------|--------------|-----------------|----------|
| macOS | arm64 | `Destrall-mac-arm64.dmg` | `Destrall-mac-arm64.zip` |
| macOS | x64 | `Destrall-mac-x64.dmg` | `Destrall-mac-x64.zip` |
| Windows | x64 | `Destrall-windows-x64.exe` | — |
| Linux | x64 | `Destrall-linux-x64.AppImage` | `.deb`, then `.rpm` |

If no matching asset exists, the UI shows: **No compatible update was found for your system.**

## Download and install flow

- Downloads are stored under the app user-data directory in an `updates/` folder (separate from wallet data).
- Progress is streamed to the renderer via `update:status-changed`.
- **Open installer** uses the OS default handler (`shell.openPath`) only after explicit user action.
- **Show in folder** uses `shell.showItemInFolder`.
- Opening the installer is blocked while a critical wallet flow is active (seed phrase, signing, dApp approval, proposal approval, etc.).

Wallet keys, seed material, and SQLite data remain in user data paths — not inside the application bundle.

## Publishing a release

1. Bump `version` in `app/package.json`.
2. Commit and push to `main`.

The GitHub Actions workflow [`.github/workflows/release.yml`](../.github/workflows/release.yml) detects when the **`version` field** in `app/package.json` changes on `main` and automatically builds and publishes a release tagged `v{version}` (for example `0.0.2` → tag `v0.0.2`).

You can still trigger a release manually:

- Push a `v*` tag, or
- Run **Actions → Release Desktop App → Run workflow**

The workflow skips release when `app/package.json` is edited but the version is unchanged (for example dependency-only changes).

Build targets:

- macOS arm64 (`macos-latest`)
- macOS x64 (`macos-13`)
- Windows x64
- Linux x64 (deb/rpm; AppImage when the maker produces one)

macOS DMGs are created with `hdiutil` from the packaged `.app` (Forge DMG maker is not used — see `app/BUILDING.md`). Artifacts are uploaded to the GitHub Release with predictable names for the update service.

Local single-target builds:

```bash
cd app
npm ci
npm run make:mac:arm64
```

Use CI for all four platform targets; `npm run make` only runs Forge make for the current host unless you pass `--platform` / `--arch`.

## Why installation is manual

- No `electron-updater` or custom uninstall/reinstall logic.
- No macOS code signing requirement for a download-and-open flow.
- Linux has no single native auto-update story across deb/rpm/AppImage — manual install keeps behavior honest and predictable.

## Security notes

- Only assets from `https://github.com/rinoco-labs/Destrall/releases/download/...` are downloaded.
- The renderer cannot pass arbitrary URLs to the updater.
- Downloaded files are never executed automatically.

## Future: signed auto-update

To move to automatic updates later:

1. Sign macOS builds (Apple Developer ID + notarization).
2. Sign Windows builds (Authenticode).
3. Publish update metadata (and optional SHA-256 checksums) alongside release assets.
4. Wire a channel-aware updater — the update module already has room for optional checksum verification on assets.

## Testing with a fake or prerelease

- **Prerelease on stable channel:** mark a GitHub release as prerelease — stable clients report no stable release.
- **Beta channel:** set `channel: 'beta'` in `app/src/config/update.ts` to allow prereleases.
- **Local version bump:** temporarily lower `version` in `app/package.json` or publish a test tag with a higher version and a draft release first.

## Checksum support (future)

Release metadata can later include entries such as:

```json
{
  "assetName": "Destrall-mac-arm64.dmg",
  "sha256": "..."
}
```

The update service is structured so verification can be added without rewriting the module.
