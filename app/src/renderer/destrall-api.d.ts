import type { DestrallApi, RpcResult } from "../../shared/ipc";

declare global {
  interface Window {
    destrallApi?: DestrallApi;
  }
}

export {};
