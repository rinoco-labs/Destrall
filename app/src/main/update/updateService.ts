import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { UPDATE_CONFIG } from "../../config/update";
import { IPCChannels } from "../../shared/ipc";
import type { UpdateInfo } from "../../shared/update";
import { criticalFlowService } from "../services/security/criticalFlowService";
import { selectReleaseAsset, unsupportedPlatformMessage } from "./assetSelection";
import type { GitHubReleaseResponse } from "./githubRelease.types";
import { isNewerRelease, normalizeReleaseVersion } from "./versionCompare";

const USER_AGENT = "Destrall-Desktop-Updater";

function createIdleState(): UpdateInfo {
  return {
    status: "idle",
    currentVersion: app.getVersion(),
  };
}

function isAllowedAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname !== "github.com") return false;
    const expectedPrefix = `/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/releases/download/`.toLowerCase();
    return parsed.pathname.toLowerCase().startsWith(expectedPrefix);
  } catch {
    return false;
  }
}

function mapFetchError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("fetch failed") || message.includes("network") || message.includes("enotfound")) {
      return "Could not reach GitHub. Check your internet connection and try again.";
    }
    if (message.includes("429") || message.includes("rate limit")) {
      return "GitHub rate limit reached. Please wait a few minutes and try again.";
    }
    return error.message;
  }
  return "An unexpected update error occurred.";
}

export class UpdateService {
  private state: UpdateInfo = createIdleState();
  private downloadAbort: AbortController | null = null;
  private selectedAsset: { name: string; url: string } | null = null;

  getUpdateStatus(): UpdateInfo {
    return { ...this.state };
  }

  private setState(patch: Partial<UpdateInfo>): UpdateInfo {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: app.getVersion(),
    };
    this.broadcastStatus();
    return this.getUpdateStatus();
  }

  private broadcastStatus(): void {
    const snapshot = this.getUpdateStatus();
    for (const window of BrowserWindow.getAllWindows()) {
      try {
        window.webContents.send(IPCChannels.updateStatusChanged, snapshot);
      } catch {
        /* window may be destroyed */
      }
    }
  }

  private getUpdateDirectory(): string {
    const directory = path.join(app.getPath("userData"), "updates");
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  private async fetchLatestRelease(): Promise<GitHubReleaseResponse> {
    const apiUrl = `https://api.github.com/repos/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/releases/latest`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status === 404) {
      throw new Error("No published releases were found for Destrall yet.");
    }
    if (response.status === 403) {
      throw new Error("GitHub rate limit reached. Please wait a few minutes and try again.");
    }
    if (!response.ok) {
      throw new Error(`Could not check for updates (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as GitHubReleaseResponse;
    if (!payload || typeof payload.tag_name !== "string") {
      throw new Error("Received an invalid release response from GitHub.");
    }
    if (payload.draft) {
      throw new Error("The latest release is still a draft.");
    }
    if (payload.prerelease && UPDATE_CONFIG.channel === "stable") {
      throw new Error("No stable release is available yet.");
    }
  if (!Array.isArray(payload.assets)) {
      throw new Error("Received an invalid release response from GitHub.");
    }

    return payload;
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    if (this.state.status === "downloading") {
      return this.getUpdateStatus();
    }

    this.setState({
      status: "checking",
      error: undefined,
      progress: undefined,
    });

    try {
      const release = await this.fetchLatestRelease();
      const latestVersion = normalizeReleaseVersion(release.tag_name);
      const currentVersion = app.getVersion();
      const asset = selectReleaseAsset(release.assets, process.platform, process.arch);

      if (!asset) {
        return this.setState({
          status: "error",
          latestVersion,
          releaseName: release.name,
          releaseNotes: release.body,
          releaseUrl: release.html_url,
          assetName: undefined,
          assetUrl: undefined,
          error: unsupportedPlatformMessage(process.platform, process.arch),
        });
      }

      if (!isAllowedAssetUrl(asset.browser_download_url)) {
        return this.setState({
          status: "error",
          error: "The selected release asset is not from the configured GitHub repository.",
        });
      }

      this.selectedAsset = {
        name: asset.name,
        url: asset.browser_download_url,
      };

      const basePatch: Partial<UpdateInfo> = {
        latestVersion,
        releaseName: release.name,
        releaseNotes: release.body,
        releaseUrl: release.html_url,
        assetName: asset.name,
        assetUrl: asset.browser_download_url,
        error: undefined,
      };

      if (!isNewerRelease(currentVersion, latestVersion)) {
        return this.setState({
          ...basePatch,
          status: "not_available",
          downloadedFilePath: undefined,
          progress: undefined,
        });
      }

      const downloadedPath = path.join(this.getUpdateDirectory(), asset.name);
      if (fs.existsSync(downloadedPath)) {
        return this.setState({
          ...basePatch,
          status: "downloaded",
          downloadedFilePath: downloadedPath,
          progress: undefined,
        });
      }

      return this.setState({
        ...basePatch,
        status: "available",
        downloadedFilePath: undefined,
        progress: undefined,
      });
    } catch (error) {
      return this.setState({
        status: "error",
        error: mapFetchError(error),
      });
    }
  }

  async downloadUpdate(): Promise<UpdateInfo> {
    if (this.state.status === "downloading") {
      return this.getUpdateStatus();
    }

    if (this.state.status !== "available" && this.state.status !== "error") {
      if (this.state.status === "downloaded") {
        return this.getUpdateStatus();
      }
      await this.checkForUpdates();
      if (this.state.status !== "available") {
        return this.getUpdateStatus();
      }
    }

    const asset = this.selectedAsset;
    if (!asset || !isAllowedAssetUrl(asset.url)) {
      return this.setState({
        status: "error",
        error: "No compatible update asset is selected.",
      });
    }

    const destination = path.join(this.getUpdateDirectory(), asset.name);
    const partialPath = `${destination}.partial`;

    this.downloadAbort?.abort();
    this.downloadAbort = new AbortController();
    const { signal } = this.downloadAbort;

    this.setState({
      status: "downloading",
      error: undefined,
      progress: { percent: 0, transferredBytes: 0, totalBytes: 0 },
    });

    try {
      if (fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath);
      }

      const response = await fetch(asset.url, {
        signal,
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });

      if (!response.ok || !response.body) {
        throw new Error(`Download failed (HTTP ${response.status}).`);
      }

      const totalBytes = Number(response.headers.get("content-length") ?? asset.name.length) || 0;
      const fileStream = fs.createWriteStream(partialPath);
      let transferredBytes = 0;

      const reader = response.body.getReader();
      try {
        let chunk = await reader.read();
        while (!chunk.done) {
          const value = chunk.value;
          if (value) {
            transferredBytes += value.byteLength;
            fileStream.write(Buffer.from(value));
            const percent =
              totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;
            this.setState({
              progress: { percent, transferredBytes, totalBytes },
            });
          }
          chunk = await reader.read();
        }
      } finally {
        fileStream.end();
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", () => resolve());
        fileStream.on("error", reject);
      });

      if (fs.existsSync(destination)) {
        fs.unlinkSync(destination);
      }
      fs.renameSync(partialPath, destination);

      return this.setState({
        status: "downloaded",
        downloadedFilePath: destination,
        progress: undefined,
        error: undefined,
      });
    } catch (error) {
      if (signal.aborted) {
        if (fs.existsSync(partialPath)) {
          fs.unlinkSync(partialPath);
        }
        return this.setState({
          status: "available",
          progress: undefined,
          error: "Download canceled.",
        });
      }

      if (fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath);
      }

      return this.setState({
        status: "error",
        progress: undefined,
        error: mapFetchError(error),
      });
    } finally {
      this.downloadAbort = null;
    }
  }

  cancelDownload(): UpdateInfo {
    this.downloadAbort?.abort();
    return this.getUpdateStatus();
  }

  async openDownloadedUpdate(): Promise<UpdateInfo> {
    criticalFlowService.assertCanOpenInstaller();

    const filePath = this.state.downloadedFilePath;
    if (!filePath || !fs.existsSync(filePath)) {
      return this.setState({
        status: "error",
        error: "The downloaded update file could not be found. Download it again.",
        downloadedFilePath: undefined,
      });
    }

    const { shell } = await import("electron");
    const openError = await shell.openPath(filePath);
    if (openError) {
      return this.setState({
        status: "error",
        error: "Could not open the installer. Try showing it in your file manager instead.",
      });
    }

    return this.getUpdateStatus();
  }

  async openReleasePage(): Promise<UpdateInfo> {
    const url = this.state.releaseUrl ?? UPDATE_CONFIG.latestReleaseUrl;
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "github.com" ||
        !parsed.pathname
          .toLowerCase()
          .startsWith(`/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/`.toLowerCase())
      ) {
        throw new Error("Release page URL is not allowed.");
      }
      const { shell } = await import("electron");
      await shell.openExternal(parsed.href);
      return this.getUpdateStatus();
    } catch (error) {
      return this.setState({
        status: "error",
        error: mapFetchError(error),
      });
    }
  }

  async revealDownloadedUpdate(): Promise<UpdateInfo> {
    const filePath = this.state.downloadedFilePath;
    if (!filePath || !fs.existsSync(filePath)) {
      return this.setState({
        status: "error",
        error: "The downloaded update file could not be found. Download it again.",
        downloadedFilePath: undefined,
      });
    }

    const { shell } = await import("electron");
    shell.showItemInFolder(filePath);
    return this.getUpdateStatus();
  }
}

export const updateService = new UpdateService();
