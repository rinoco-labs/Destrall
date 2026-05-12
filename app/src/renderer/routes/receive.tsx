import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WALLET_ADDRESS } from "@/lib/wallet-store";

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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
    WALLET_ADDRESS,
  )}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* noop */
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
            Scan or share your wallet address to receive tokens.
          </p>

          <div className="mt-6 mx-auto inline-block rounded-2xl bg-white p-4 shadow-md">
            <img
              src={qrUrl}
              alt="Wallet QR code"
              width={256}
              height={256}
              className="block w-64 h-64"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Wallet address
            </p>
            <div className="rounded-xl border border-border bg-background/60 px-4 py-3 flex items-center gap-3">
              <span className="flex-1 text-left font-mono text-sm break-all">
                {WALLET_ADDRESS}
              </span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-xs font-semibold hover:opacity-95 transition"
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

          <p className="mt-6 text-xs text-muted-foreground">
            Only send compatible tokens to this address. Sending unsupported assets
            may result in permanent loss.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
