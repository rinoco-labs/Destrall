import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";

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
  const [password, setPassword] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    navigate({ to: "/home" });
  };

  return (
    <main className="min-h-screen w-full bg-background text-foreground flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col items-center">
        <div
          className="w-20 h-20 rounded-2xl bg-card/60 border border-border flex items-center justify-center mb-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <Lock className="w-9 h-9 text-brand" />
        </div>
        <h1 className="text-3xl font-bold mb-2">App Locked</h1>
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

        <button
          type="submit"
          disabled={!password.trim()}
          className="w-full rounded-2xl bg-brand text-brand-foreground font-semibold py-4 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
