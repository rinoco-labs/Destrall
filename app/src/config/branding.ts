/** Central branding constants — import from here, not individual asset paths. */

import adaptiveIconUrl from "../assets/branding/adaptive-icon.png?url";
import faviconUrl from "../assets/branding/favicon.png?url";
import iconUrl from "../assets/branding/icon.png?url";
import logoMarkUrl from "../assets/branding/logo-mark.png?url";
import logoUrl from "../assets/branding/logo.png?url";
import splashUrl from "../assets/branding/splash.png?url";

export const BRANDING = {
  appName: "Destrall",
  tagline: "Your multi-chain wallet with an on-device assistant",
  /** Bundled raster URLs (Vite ?url) — works in dev and packaged file:// renderer. */
  assets: {
    logo: logoUrl,
    logoMark: logoMarkUrl,
    icon: iconUrl,
    splash: splashUrl,
    adaptiveIcon: adaptiveIconUrl,
    favicon: faviconUrl,
  },
  colors: {
    primary: "#0241ff",
    primaryLight: "#5f91ff",
    splashBackground: "#0241ff",
    gradient:
      "radial-gradient(circle at 50% 0%, #ffffff 0%, #eef4ff 8%, #cedeff 20%, #a3c2ff 34%, #6fa0ff 50%, #5f91ff 58%, #477dff 70%, #0241ff 100%)",
  },
} as const;

export type BrandingAssetKey = keyof typeof BRANDING.assets;
