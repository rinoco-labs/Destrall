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
  Trash2,
  Pencil,
  Smile,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  useAccountsStore,
  ACCOUNT_COLORS,
  colorClass,
  getInitial,
} from "@/stores/accountsStore";
import { WALLET_ADDRESS, shortAddr } from "@/lib/wallet-store";

export const Route = createFileRoute("/account/$accountId")({
  component: AccountSettingsPage,
  head: () => ({
    meta: [
      { title: "Account settings — Destrall" },
      {
        name: "description",
        content:
          "Customize this account: rename, change icon, manage preferences, or delete.",
      },
    ],
  }),
});

const EMOJI_PRESETS = [
  "",
  "🦊",
  "🐼",
  "🚀",
  "🌙",
  "⭐",
  "🔥",
  "💎",
  "🌊",
  "🎯",
  "🍀",
  "🪐",
];

function AccountSettingsPage() {
  const { accountId } = Route.useParams();
  const navigate = useNavigate();
  const account = useAccountsStore((s) =>
    s.accounts.find((a) => a.id === accountId),
  );
  const accountsCount = useAccountsStore((s) => s.accounts.length);
  const updateAccount = useAccountsStore((s) => s.updateAccount);
  const removeAccount = useAccountsStore((s) => s.removeAccount);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(account?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const initial = useMemo(
    () => (account ? getInitial(account) : "?"),
    [account],
  );

  if (!account) {
    return (
      <AppShell active="settings">
        <div className="max-w-xl mx-auto py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Account not found</h1>
          <p className="text-muted-foreground mb-6">
            This account no longer exists.
          </p>
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

  const saveName = () => {
    const next = nameDraft.trim();
    if (next && next !== account.name) {
      updateAccount(account.id, { name: next });
    } else {
      setNameDraft(account.name);
    }
    setEditingName(false);
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleDelete = () => {
    removeAccount(account.id);
    navigate({ to: "/settings" });
  };

  const isLast = accountsCount <= 1;

  return (
    <AppShell active="settings">
      <div className="max-w-3xl mx-auto w-full px-2 pb-12">
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Settings
        </Link>

        {/* Header */}
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-6 mb-8 flex items-center gap-5">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${colorClass(account.color)}`}
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
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") {
                      setNameDraft(account.name);
                      setEditingName(false);
                    }
                  }}
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-lg font-semibold focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
                <button
                  type="button"
                  onClick={saveName}
                  className="rounded-full bg-brand text-brand-foreground text-sm font-semibold px-4 py-2 hover:opacity-95 transition"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {account.name}
                </h1>
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
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {shortAddr(WALLET_ADDRESS)}
            </p>
          </div>
          <button
            type="button"
            onClick={copyAddress}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/40 transition"
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

        {/* Icon */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          Icon
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 mb-8">
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Smile className="w-4 h-4" /> Pick an emoji or use the first letter.
          </div>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((emoji) => {
              const isActive = account.icon === emoji;
              return (
                <button
                  key={emoji || "default"}
                  type="button"
                  onClick={() => updateAccount(account.id, { icon: emoji })}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center text-lg transition ${
                    isActive
                      ? "border-brand bg-brand/10"
                      : "border-border hover:bg-secondary/40"
                  }`}
                  aria-label={emoji ? `Use ${emoji}` : "Use first letter"}
                >
                  {emoji || account.name.charAt(0).toUpperCase() || "?"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          Color
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-5 mb-8">
          <div className="flex flex-wrap gap-3">
            {ACCOUNT_COLORS.map((c) => {
              const isActive = account.color === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => updateAccount(account.id, { color: c.key })}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-brand bg-brand/10"
                      : "border-border hover:bg-secondary/40"
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

        {/* Preferences */}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
          Preferences
        </p>
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden mb-8">
          <ToggleRow
            icon={account.hideBalance ? EyeOff : Eye}
            label="Hide balance"
            description="Mask the balance for this account on the home screen."
            checked={account.hideBalance}
            onChange={(v) => updateAccount(account.id, { hideBalance: v })}
          />
          <ToggleRow
            icon={Bell}
            label="Notifications"
            description="Receive activity alerts for this account."
            checked={account.notifications}
            onChange={(v) => updateAccount(account.id, { notifications: v })}
          />
          <ToggleRow
            icon={Send}
            label="Default for sending"
            description="Use this account by default on the Send screen."
            checked={account.defaultForSend}
            onChange={(v) => updateAccount(account.id, { defaultForSend: v })}
          />
        </div>

        {/* Danger */}
        <p className="text-xs uppercase tracking-[0.2em] text-destructive/80 mb-3 px-1">
          Danger zone
        </p>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Delete this account
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Removes the account from this device. Your funds remain on-chain
                and can be restored with your recovery phrase.
                {isLast && " You must keep at least one account."}
              </p>
            </div>
          </div>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLast}
                className="inline-flex items-center gap-2 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold px-5 py-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Trash2 className="w-4 h-4" /> Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isLast}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/40 text-destructive text-sm font-semibold px-5 py-2 hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="w-4 h-4" /> Delete account
            </button>
          )}
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
        className={`relative w-11 h-6 rounded-full transition ${
          checked ? "bg-brand" : "bg-secondary"
        }`}
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
