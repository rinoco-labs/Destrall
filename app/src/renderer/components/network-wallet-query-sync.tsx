import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import { subscribeChainNetworkChanged } from "@/lib/desktopChain";
import { useNetworkStore } from "@/stores/networkStore";
import { useWalletStore } from "@/stores/walletStore";

export const chainQueryScope = ["chain"] as const;

export function NetworkWalletQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isDestrallDesktop()) return;
    void useNetworkStore.getState().initializeNetworkState();
  }, []);

  useEffect(() => {
    if (!isDestrallDesktop()) return;
    const off = subscribeChainNetworkChanged(() => {
      void useNetworkStore.getState().initializeNetworkState();
      void queryClient.invalidateQueries({ queryKey: chainQueryScope });
    });
    return off;
  }, [queryClient]);

  useEffect(() => {
    if (!isDestrallDesktop()) return;
    return useWalletStore.subscribe((state, prev) => {
      if (state.activeAccountId !== prev.activeAccountId) {
        void queryClient.invalidateQueries({ queryKey: chainQueryScope });
      }
    });
  }, [queryClient]);

  return null;
}
