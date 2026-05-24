export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not_available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdateProgress = {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
};

/** Future checksum verification — optional on release assets. */
export type UpdateAssetChecksum = {
  assetName: string;
  sha256: string;
};

export type UpdateInfo = {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  assetName?: string;
  assetUrl?: string;
  downloadedFilePath?: string;
  progress?: UpdateProgress;
  error?: string;
};
