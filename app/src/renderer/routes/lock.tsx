import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useWalletStore } from "@/stores/walletStore";
import { AppLogo } from "@/components/branding/AppLogo";
import { BRANDING } from "@config/branding";

export const Route = createFileRoute("/lock")({
  component: LockPage,
  head: () => ({
    meta: [
      { title: "App Locked — Destrall" },
      { name: "description", content: "Enter your password to unlock Destrall." },
    ],
  }),
});

function LockPage() {
  const navigate = useNavigate();
  const unlockWallet = useWalletStore((s) => s.unlockWallet);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await unlockWallet(password);
      navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock wallet");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-background text-foreground flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-2xl bg-card/60 border border-border flex items-center justify-center mb-6 p-3"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <AppLogo variant="icon" size="lg" className="w-full h-full justify-center" imageClassName="w-full h-full" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{BRANDING.appName} locked</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Enter your password to unlock
        </p>

        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-2xl border border-brand/40 bg-card/60 px-5 py-4 text-center text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition mb-4"
        />

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={!password.trim() || isSubmitting}
          className="w-full rounded-2xl bg-brand text-brand-foreground font-semibold py-4 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
