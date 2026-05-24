export type UpdateChannel = "stable" | "beta";

export const UPDATE_CONFIG = {
  owner: "Galliun",
  repo: "Destrall",
  channel: "stable" satisfies UpdateChannel,
  releasesUrl: "https://github.com/Galliun/Destrall/releases",
  latestReleaseUrl: "https://github.com/Galliun/Destrall/releases/latest",
} as const;
