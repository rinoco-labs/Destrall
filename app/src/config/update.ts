export type UpdateChannel = "stable" | "beta";

export const UPDATE_CONFIG = {
  owner: "rinoco-labs",
  repo: "Destrall",
  channel: "stable" satisfies UpdateChannel,
  releasesUrl: "https://github.com/rinoco-labs/Destrall/releases",
  latestReleaseUrl: "https://github.com/rinoco-labs/Destrall/releases/latest",
} as const;
