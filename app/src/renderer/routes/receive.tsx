import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, Share2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { shortAddr } from "@/lib/wallet-store";

export const Route = createFileRoute("/receive")({
  component: ReceivePage,
  head: () => ({
    meta: [
      { title: "Receive — Destrall" },
      { name: "description", content: "Receive tokens to your Destrall wallet." },
    ],
  }),
});

function ReceivePage() {
  const [copied, setCopied] = useState(false);
  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const addr = activeAccount?.address ?? "";
  const network = useNetworkStore((s) => s.network);

  const qrUrl = addr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(addr)}`
    : "";

  const copy = async () => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
    }
  };

  const share = async () => {
    if (!addr || !navigator.share) return;
    try {
      await navigator.share({
        title: "My Sui address",
        text: addr,
      });
    } catch {
      /* user cancelled or unsupported */
    }
  };

  return (
    <AppShell active="home">
      <div className="max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/home"
            className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Receive</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Scan or share your wallet address to receive tokens on{" "}
            <span className="text-foreground font-medium">
              {network ? `${network.activeChain} · ${network.activeEnvironment}` : "the active network"}
            </span>
            .
          </p>

          {addr ? (
            <>
              <div className="mt-6 mx-auto inline-block rounded-2xl bg-white p-4 shadow-md">
                <img src={qrUrl} alt="Wallet QR code" width={256} height={256} className="block w-64 h-64" />
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Wallet address</p>
                <div className="rounded-xl border border-border bg-background/60 px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 text-left font-mono text-sm break-all">{addr}</span>
                  <button
                    type="button"
                    onClick={() => void copy()}
                    className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-xs font-semibold hover:opacity-95 transition shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  type="button"
                  onClick={() => void share()}
                  className="mt-4 inline-flex items-center gap-2 text-sm text-brand hover:opacity-80"
                >
                  <Share2 className="w-4 h-4" />
                  Share address
                </button>
              )}
            </>
          ) : (
            <p className="mt-8 text-sm text-muted-foreground">Unlock your wallet to see a receive address.</p>
          )}

          {activeAccount && (
            <p className="mt-4 text-xs text-muted-foreground">
              Account: <span className="text-foreground font-medium">{activeAccount.name}</span> ·{" "}
              {shortAddr(activeAccount.address, 10, 10)}
            </p>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            Only send compatible tokens on this network. Unsupported assets may be lost.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
