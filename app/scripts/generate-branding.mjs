/**
 * Generates raster branding assets.
 * - icon-square.png → desktop icons (.icns / .ico / .png), favicons (transparent, inset)
 * - logo.svg → inline mark, splash, wallet injection data URI
 *
 * Run: npm run branding:generate
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");
const BRANDING_DIR = path.join(APP_ROOT, "src/assets/branding");
const PUBLIC_DIR = path.join(APP_ROOT, "public");
const SOURCE_SVG = path.join(BRANDING_DIR, "logo.svg");
const SOURCE_ICON_SQUARE = path.join(BRANDING_DIR, "icon-square.png");

const PADDING_RATIO = 0.1;
/** Inset so Dock/taskbar icons match macOS visual size (transparent margin). */
const PLATFORM_ICON_INSET_RATIO = 0.1;
const BLACK_KEY_THRESHOLD = 20;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** Turn opaque black letterboxing into transparency. */
function knockOutBlackBackground(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= BLACK_KEY_THRESHOLD && g <= BLACK_KEY_THRESHOLD && b <= BLACK_KEY_THRESHOLD) {
      data[i + 3] = 0;
    }
  }
}

/**
 * Platform icon: transparent canvas, inset artwork, no black corners.
 * Used for .icns, .ico, desktop-icon.png, and Dock/taskbar runtime.
 */
async function platformIconPngBuffer(size) {
  const inset = Math.round(size * PLATFORM_ICON_INSET_RATIO);
  const inner = Math.max(1, size - inset * 2);

  const { data, info } = await sharp(SOURCE_ICON_SQUARE)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  knockOutBlackBackground(data);

  const iconLayer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: iconLayer, gravity: "center" }])
    .png({ compressionLevel: 9, force: true })
    .toBuffer();
}

async function renderPlatformIconPng(size, outPath) {
  const buffer = await platformIconPngBuffer(size);
  await fs.writeFile(outPath, buffer);
  return buffer;
}

/** Full-bleed tile for in-app UI (still keys out black corners). */
async function renderIconSquarePng(size, outPath) {
  const { data, info } = await sharp(SOURCE_ICON_SQUARE)
    .resize(size, size, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  knockOutBlackBackground(data);

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, force: true })
    .toFile(outPath);
}

async function renderSvgSquarePng(size, outPath, { paddingRatio = PADDING_RATIO } = {}) {
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;
  const buffer = await sharp(SOURCE_SVG)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(buffer).png().toFile(outPath);
  return buffer;
}

async function renderSplash(outPath) {
  const width = 1284;
  const height = 2778;
  const logoSize = 420;
  const logoBuffer = await sharp(SOURCE_SVG)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 2, g: 65, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png()
    .toFile(outPath);
}

async function writeIco(outPath, sizes) {
  const buffers = await Promise.all(sizes.map((size) => platformIconPngBuffer(size)));
  const ico = await pngToIco(buffers);
  await fs.writeFile(outPath, ico);
}

/** macOS iconset slots (base name → pixel size). */
const ICNS_ICONSET = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

async function writeIcns(outPath) {
  if (process.platform !== "darwin") {
    console.warn("Skipping .icns generation (iconutil requires macOS).");
    return;
  }
  const iconsetDir = path.join(BRANDING_DIR, "Destrall.iconset");
  await fs.rm(iconsetDir, { recursive: true, force: true });
  await ensureDir(iconsetDir);
  for (const [filename, px] of ICNS_ICONSET) {
    await renderPlatformIconPng(px, path.join(iconsetDir, filename));
  }
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${outPath}"`, { stdio: "inherit" });
  } catch (err) {
    console.warn(
      `Could not build desktop-icon.icns (${err instanceof Error ? err.message : err}). ` +
        "Re-run branding:generate on macOS.",
    );
  } finally {
    await fs.rm(iconsetDir, { recursive: true, force: true });
  }
}

async function main() {
  await ensureDir(BRANDING_DIR);
  await ensureDir(PUBLIC_DIR);

  try {
    await fs.access(SOURCE_SVG);
  } catch {
    throw new Error(`Missing source SVG at ${SOURCE_SVG}`);
  }
  try {
    await fs.access(SOURCE_ICON_SQUARE);
  } catch {
    throw new Error(`Missing square app icon at ${SOURCE_ICON_SQUARE}`);
  }

  console.log("Generating branding assets (icon-square.png + logo.svg)…");

  // SVG-derived: transparent mark for inline UI, full logo tile, splash
  await renderSvgSquarePng(1024, path.join(BRANDING_DIR, "logo.png"));
  await renderSvgSquarePng(512, path.join(BRANDING_DIR, "logo-mark.png"));
  await renderSplash(path.join(BRANDING_DIR, "splash.png"));

  // Full-bleed raster for in-app tiles
  await renderIconSquarePng(1024, path.join(BRANDING_DIR, "icon.png"));
  await renderIconSquarePng(1024, path.join(BRANDING_DIR, "adaptive-icon.png"));

  // Platform icons: transparent + inset (Dock, taskbar, packager)
  await renderPlatformIconPng(1024, path.join(BRANDING_DIR, "desktop-icon.png"));
  await renderPlatformIconPng(32, path.join(BRANDING_DIR, "favicon.png"));
  await writeIco(path.join(BRANDING_DIR, "desktop-icon.ico"), [16, 24, 32, 48, 64, 128, 256]);
  await writeIcns(path.join(BRANDING_DIR, "desktop-icon.icns"));

  const publicCopies = [
    ["favicon.png", "favicon.png"],
    ["favicon.png", "favicon-32x32.png"],
    ["logo.png", "logo.png"],
    ["logo-mark.png", "logo-mark.png"],
    ["icon.png", "icon.png"],
    ["icon.png", "icon-512.png"],
    ["splash.png", "splash.png"],
    ["adaptive-icon.png", "adaptive-icon.png"],
    ["desktop-icon.png", "desktop-icon.png"],
  ];
  for (const [src, dest] of publicCopies) {
    await fs.copyFile(path.join(BRANDING_DIR, src), path.join(PUBLIC_DIR, dest));
  }
  await renderPlatformIconPng(16, path.join(PUBLIC_DIR, "favicon-16x16.png"));
  await renderPlatformIconPng(180, path.join(PUBLIC_DIR, "apple-touch-icon.png"));
  await renderPlatformIconPng(192, path.join(PUBLIC_DIR, "icon-192.png"));

  await renderIconSquarePng(64, path.join(BRANDING_DIR, "wallet-injection-icon.png"));
  const injectionPng = await fs.readFile(path.join(BRANDING_DIR, "wallet-injection-icon.png"));
  const walletInjectionIconUri = `data:image/png;base64,${injectionPng.toString("base64")}`;
  const walletInjectionIconTs = `/** Auto-generated by npm run branding:generate — do not edit manually */\nexport const WALLET_INJECTION_ICON_DATA_URI = ${JSON.stringify(walletInjectionIconUri)};\n`;
  await fs.writeFile(
    path.join(APP_ROOT, "src/config/walletInjectionIcon.ts"),
    walletInjectionIconTs,
  );

  const desktopPng = await sharp(path.join(BRANDING_DIR, "desktop-icon.png")).metadata();
  console.log(
    `desktop-icon.png: ${desktopPng.width}x${desktopPng.height}, alpha=${desktopPng.hasAlpha}`,
  );
  console.log(
    "Done. Platform icons: desktop-icon.icns (macOS), desktop-icon.ico (Windows), desktop-icon.png (Linux/runtime)",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
