# Building Destrall desktop releases

All packaging commands run from the **`app/`** directory (Electron Forge + Vite).

## Prerequisites

- Node.js 25+ (see `app/.nvmrc`)
- `npm ci` in `app/`
- Platform-specific tools when building **locally** on that OS:
  - **Windows**: Squirrel installer is most reliable on `win32` (CI uses `windows-latest`).
  - **Linux**: `.deb` / `.rpm` makers need `dpkg`, `fakeroot`, and `rpmbuild` (CI installs these on `ubuntu-latest`).

Native modules (for example `node-llama-cpp`) are rebuilt for the target architecture via Forge’s rebuild step and `@electron-forge/plugin-auto-unpack-natives`.

## macOS distribution format

macOS releases use **DMG** installers in CI (`hdiutil` wraps the packaged `.app`). The Forge DMG maker (`appdmg` / `macos-alias`) is **not used**: those packages rely on unmaintained native addons that **fail to compile on Node 25+**. A **ZIP** fallback is also published and accepted by the in-app updater.

## In-app updates

The desktop app checks GitHub Releases and downloads the correct asset for the user’s OS/architecture. Users open the installer manually; nothing is auto-installed. See [`docs/update-service.md`](../docs/update-service.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run make` | Clean `out/`, then build **all** targets in sequence (fails on first error). |
| `npm run make:all` | Same as `make`. |
| `npm run clean:make` | Remove `app/out/` (packaged apps and installers). |
| `npm run make:mac:arm64` | macOS Apple Silicon (`darwin` / `arm64`). |
| `npm run make:mac:x64` | macOS Intel (`darwin` / `x64`). |
| `npm run make:mac:universal` | macOS universal binary (`darwin` / `universal`). |
| `npm run make:win:x64` | Windows x64 (`win32` / `x64`). |
| `npm run make:linux:x64` | Linux x64 (`linux` / `x64`). |

Every `make:*` script passes explicit `--platform` and `--arch` flags (no host defaults).

## Artifact locations

Installers and archives are written under **`app/out/make/`**, grouped by maker and platform:

| Platform | Typical paths |
|----------|----------------|
| macOS arm64 / x64 | `out/make/zip/darwin/<arch>/…zip`; CI also uploads `Destrall-mac-<arch>.dmg` |
| Windows x64 | `out/make/squirrel.windows/x64/`, `out/make/zip/win32/x64/` |
| Linux x64 | `out/make/deb/x64/`, `out/make/rpm/x64/`, `out/make/zip/linux/x64/` |

Packaged (unsigned) app bundles also appear under `app/out/` before makers run.

## Local builds vs CI

**`npm run make`** attempts macOS arm64, macOS x64, Windows x64, and Linux x64 in one run.

On **macOS**, from a single `npm run make`:

| Target | What you get locally |
|--------|----------------------|
| `make:mac:*` | ZIP (full macOS artifacts) |
| `make:win:x64` | **ZIP only** (portable Windows build) |
| `make:linux:x64` | **ZIP only** (portable Linux build) |

**Squirrel** (`.exe` installer) is registered only when Forge runs on **Windows** — it requires Mono+Wine on macOS, which we do not use. **deb/rpm** are registered only on **Linux** hosts.

For Squirrel installers and Linux packages, use **`.github/workflows/release.yml`** (`windows-latest` / `ubuntu-latest`).

## Single-platform examples

```bash
cd app
npm ci
npm run make:mac:arm64
npm run make:win:x64      # best on Windows
npm run make:linux:x64    # best on Linux
```

## Makers configured in `forge.config.ts`

| Platform | Any host (cross-make) | Native host only |
|----------|----------------------|------------------|
| darwin | ZIP | — |
| win32 | ZIP (not on Windows — use Squirrel there) | Squirrel (Windows runner) |
| linux | ZIP | deb, rpm (Linux runner) |
