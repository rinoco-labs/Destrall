import type { DestrallApi } from "../../shared/ipc";

declare global {
  interface Window {
    destrallApi?: DestrallApi;
  }
}

export {};
