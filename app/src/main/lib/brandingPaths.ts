import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const BRANDING_DIRNAME = "branding";

function brandingDirExists(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "desktop-icon.icns")) ||
    fs.existsSync(path.join(dir, "desktop-icon.ico")) ||
    fs.existsSync(path.join(dir, "desktop-icon.png"))
  );
}

/** Dev candidates: main bundle dir, project root via getAppPath/cwd, source tree. */
function resolveDevBrandingDir(): string {
  const candidates: string[] = [];

  if (typeof __dirname !== "undefined") {
    candidates.push(path.join(__dirname, BRANDING_DIRNAME));
    candidates.push(path.join(__dirname, "../../src/assets/branding"));
  }

  try {
    candidates.push(path.join(app.getAppPath(), "src/assets/branding"));
  } catch {
    // app not ready yet
  }

  candidates.push(path.join(process.cwd(), "src/assets/branding"));

  for (const dir of candidates) {
    if (brandingDirExists(dir)) {
      return dir;
    }
  }

  return candidates[0] ?? path.join(process.cwd(), "src/assets/branding");
}

/** Resolved paths to branding files (main process / Electron APIs). */
export function getBrandingDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, BRANDING_DIRNAME);
  }
  return resolveDevBrandingDir();
}

/**
 * Icon path for Electron runtime (BrowserWindow, Dock).
 * All platforms use generated assets with transparent margins:
 * .icns (macOS), .ico (Windows), .png (Linux).
 */
export function getBrandingRuntimeIconPath(): string {
  const dir = getBrandingDir();
  if (process.platform === "darwin") {
    const icns = path.join(dir, "desktop-icon.icns");
    if (fs.existsSync(icns)) {
      return icns;
    }
    return path.join(dir, "desktop-icon.png");
  }
  if (process.platform === "win32") {
    return path.join(dir, "desktop-icon.ico");
  }
  return path.join(dir, "desktop-icon.png");
}

/**
 * Base path without extension for electron-packager / Forge.
 * Forge picks .icns / .ico / .png per platform.
 */
export function getBrandingPackagerIconBase(): string {
  return path.join(getBrandingDir(), "desktop-icon");
}

/** @deprecated Use getBrandingRuntimeIconPath */
export function getBrandingPlatformIconPath(): string {
  return getBrandingRuntimeIconPath();
}

/** @deprecated Use getBrandingRuntimeIconPath */
export function getBrandingDesktopIconPath(): string {
  return getBrandingRuntimeIconPath();
}

/** Raster app tile (1024px) for in-app `<img>` imports via branding.ts — not for Electron window APIs. */
export function getBrandingIconPath(): string {
  return path.join(getBrandingDir(), "icon.png");
}
