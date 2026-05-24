import type { GitHubReleaseAsset } from "./githubRelease.types";

const ASSET_PREFERENCES: Record<string, string[]> = {
  "darwin-arm64": ["Destrall-mac-arm64.dmg", "Destrall-mac-arm64.zip"],
  "darwin-x64": ["Destrall-mac-x64.dmg", "Destrall-mac-x64.zip"],
  "win32-x64": ["Destrall-windows-x64.exe"],
  "linux-x64": [
    "Destrall-linux-x64.AppImage",
    "Destrall-linux-x64.deb",
    "Destrall-linux-x64.rpm",
  ],
};

export function getPlatformArchKey(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === "darwin" && (arch === "arm64" || arch === "x64")) {
    return `${platform}-${arch}`;
  }
  if (platform === "win32" && arch === "x64") {
    return `${platform}-${arch}`;
  }
  if (platform === "linux" && arch === "x64") {
    return `${platform}-${arch}`;
  }
  return null;
}

export function selectReleaseAsset(
  assets: GitHubReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string,
): GitHubReleaseAsset | null {
  const key = getPlatformArchKey(platform, arch);
  if (!key) return null;

  const preferences = ASSET_PREFERENCES[key] ?? [];
  for (const preferredName of preferences) {
    const match = assets.find((asset) => asset.name === preferredName);
    if (match) return match;
  }

  return null;
}

export function unsupportedPlatformMessage(platform: NodeJS.Platform, arch: string): string {
  return `No compatible update was found for your system (${platform} ${arch}).`;
}
