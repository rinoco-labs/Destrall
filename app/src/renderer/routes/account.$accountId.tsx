import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  Bell,
  Send,
  Pencil,
  Smile,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ACCOUNT_COLORS, colorClass, getInitial } from "@/stores/accountsStore";
import { shortAddr } from "@/lib/wallet-store";
import { useWalletStore } from "@/stores/walletStore";

export const Route = createFileRoute("/account/$accountId")({
  component: AccountSettingsPage,
  head: () => ({
    meta: [
      { title: "Account settings — Destrall" },
      {
        name: "description",
        content: "Customize this account: rename, change icon, or manage preferences.",
      },
    ],
  }),
});

const EMOJI_PRESETS = ["", "🦊", "🐼", "🚀", "🌙", "⭐", "🔥", "💎", "🌊", "🎯", "🍀", "🪐"];

function AccountSettingsPage() {
  const { accountId } = Route.useParams();
  const navigate = useNavigate();
  const accounts = useWalletStore((s) => s.accounts);
  const renameAccount = useWalletStore((s) => s.renameAccount);
  const updateAccountIcon = useWalletStore((s) => s.updateAccountIcon);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId && a.chain === "sui"),
    [accounts, accountId],
  );

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(account?.name ?? "");
  const [copied, setCopied] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const initial = useMemo(
    () => (account ? getInitial({ name: account.name, icon: account.icon ?? "" }) : "?"),
    [account],
  );

  if (!account) {
    return (
      <AppShell active="settings">
        <div className="max-w-xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Account not found</h1>
          <p className="text-muted-foreground mb-6">This account no longer exists.</p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary/40 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to settings
          </Link>
        </div>
      </AppShell>
    );
  }

  const colorKey = (account.color as (typeof ACCOUNT_COLORS)[number]["key"]) ?? "brand";

  const saveName = async () => {
    const next = nameDraft.trim();
    if (next && next !== account.name) {
      await renameAccount(account.id, next);
    } else {
      setNameDraft(account.name);
    }
    setEditingName(false);
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <AppShell active="settings">
      <div className="max-w-3xl mx-auto w-full px-2 pb-12">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Settings
        </Link>

        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-6 mb-8 flex items-center gap-5">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${colorClass(colorKey)}`}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") {
                      setNameDraft(account.name);
                      setEditingName(false);
                    }
                  }}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-lg font-semibold focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  className="rounded-full bg-brand text-brand-foreground text-sm font-semibold px-4 py-2 hover:opacity-95 transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight truncate">{account.name}</h1>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(account.name);
                    setEditingName(true);
                  }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
                  aria-label="Edit name"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{account.address}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{shortAddr(account.address, 10, 10)}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyAddress()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/40 transition shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy
              </>
            )}
          </button>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">Icon</p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 mb-8">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Smile className="w-4 h-4" /> Pick an emoji or use the first letter.
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((emoji) => {
              const isActive = (account.icon ?? "") === emoji;
              return (
                <button
                  key={emoji || "default"}
                  type="button"
                  onClick={() => void updateAccountIcon(account.id, emoji || null, undefined)}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg transition ${
                    isActive ? "border-brand bg-brand/10" : "border-border hover:bg-secondary/40"
                  }`}
                  aria-label={emoji ? `Use ${emoji}` : "Use first letter"}
                >
                  {emoji || account.name.charAt(0).toUpperCase() || "?"}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">Color</p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 mb-8">
          <div className="flex flex-wrap gap-3">
            {ACCOUNT_COLORS.map((c) => {
              const isActive = colorKey === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => void updateAccountIcon(account.id, undefined, c.key)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive ? "border-brand bg-brand/10" : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full ${c.className} flex items-center justify-center text-[10px] font-bold`}
                  >
                    {initial}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">Preferences</p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          <ToggleRow
            icon={hideBalance ? EyeOff : Eye}
            label="Hide balance"
            description="Mask the balance for this account on the home screen (local UI only)."
            checked={hideBalance}
            onChange={setHideBalance}
          />
          <ToggleRow
            icon={Bell}
            label="Notifications"
            description="Receive activity alerts for this account (local UI only)."
            checked={notifications}
            onChange={setNotifications}
          />
          <ToggleRow
            icon={Send}
            label="Default for sending"
            description="Prefer this account when opening Send (local UI only)."
            checked={false}
            onChange={() => {}}
          />
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          <p>
            Account deletion from the vault is not available in this version. Your keys remain in the encrypted
            wallet on this device.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/50 transition"
          >
            Back to settings
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition ${checked ? "bg-brand" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
