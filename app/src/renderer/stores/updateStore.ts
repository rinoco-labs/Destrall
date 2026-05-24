import { create } from "zustand";
import type { UpdateInfo } from "../../shared/update";
import {
  desktopUpdateCheck,
  desktopUpdateDownload,
  desktopUpdateGetStatus,
  desktopUpdateOpenDownloaded,
  desktopUpdateOpenReleasePage,
  desktopUpdateRevealDownloaded,
} from "@/lib/desktopUpdates";
import { isDestrallDesktop } from "@/lib/desktopWallet";

type UpdateStore = {
  status: UpdateInfo | null;
  bannerDismissed: boolean;
  setStatus: (status: UpdateInfo) => void;
  refreshStatus: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  openDownloaded: () => Promise<void>;
  revealDownloaded: () => Promise<void>;
  openReleasePage: () => Promise<void>;
  dismissBanner: () => void;
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: null,
  bannerDismissed: false,

  setStatus: (status) => set({ status }),

  refreshStatus: async () => {
    if (!isDestrallDesktop()) return;
    const status = await desktopUpdateGetStatus();
    set({ status });
  },

  checkForUpdates: async () => {
    if (!isDestrallDesktop()) return;
    const status = await desktopUpdateCheck();
    set({ status, bannerDismissed: false });
  },

  downloadUpdate: async () => {
    if (!isDestrallDesktop()) return;
    const status = await desktopUpdateDownload();
    set({ status, bannerDismissed: false });
  },

  openDownloaded: async () => {
    if (!isDestrallDesktop()) return;
    const status = await desktopUpdateOpenDownloaded();
    set({ status });
  },

  revealDownloaded: async () => {
    if (!isDestrallDesktop()) return;
    const status = await desktopUpdateRevealDownloaded();
    set({ status });
  },

  openReleasePage: async () => {
    if (!isDestrallDesktop()) return;
    await desktopUpdateOpenReleasePage();
  },

  dismissBanner: () => set({ bannerDismissed: true }),
}));
