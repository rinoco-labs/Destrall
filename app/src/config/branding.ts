/** Central branding constants — import from here, not individual asset paths. */
export const BRANDING = {
  appName: "Destrall",
  tagline: "Your multi-chain wallet with an on-device assistant",
  /** Static URLs served from `public/` (no build-time import required). */
  assets: {
    logo: "/logo.png",
    logoMark: "/logo-mark.png",
    icon: "/icon.png",
    splash: "/splash.png",
    adaptiveIcon: "/adaptive-icon.png",
    favicon: "/favicon.png",
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
