import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  MessageSquareText,
  Store,
  Settings as SettingsIcon,
  Code2,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/use-theme";
import {
  useAccountsStore,
  colorClass,
  getInitial,
} from "@/stores/accountsStore";

type NavKey = "home" | "assistant" | "store" | "settings" | "developer";

type NavItem = {
  key: NavKey;
  i18nKey: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOP_NAV: NavItem[] = [
  { key: "home", i18nKey: "nav.home", to: "/home", icon: Home },
  { key: "assistant", i18nKey: "nav.assistant", to: "/assistant", icon: MessageSquareText },
  { key: "store", i18nKey: "nav.store", to: "/store", icon: Store },
];

const SIDE_NAV: NavItem[] = [
  { key: "settings", i18nKey: "nav.settings", to: "/settings", icon: SettingsIcon },
  { key: "developer", i18nKey: "nav.developer", to: "/developer", icon: Code2 },
];

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: NavKey;
}) {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const accounts = useAccountsStore((s) => s.accounts);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const setActive = useAccountsStore((s) => s.setActive);
  const addAccount = useAccountsStore((s) => s.addAccount);
  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newName, setNewName] = useState("");

  const createAccount = () => {
    const name = newName.trim();
    if (!name) return;
    addAccount(name);
    setNewName("");
    setShowNewAccount(false);
  };

  return (
    <main className="h-screen w-full bg-background text-foreground flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? "w-16" : "w-64"
        } shrink-0 border-r border-border p-3 hidden md:flex flex-col gap-6 transition-all duration-200 h-screen overflow-hidden`}
      >
        <div className="flex items-center justify-between px-2 pt-2">
          {!collapsed && <div className="text-lg font-bold">Destrall</div>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="space-y-1">
          {SIDE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? t(item.i18nKey) : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{t(item.i18nKey)}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Accounts
              </p>
              <button
                type="button"
                onClick={() => setShowNewAccount(true)}
                className="inline-flex items-center gap-1 text-xs text-brand hover:opacity-80 transition font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </div>
            <div className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
              {accounts.map((acc) => {
                const isActiveAcc = acc.id === activeAccountId;
                return (
                  <div
                    key={acc.id}
                    className={`group w-full flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-2 text-left transition ${
                      isActiveAcc
                        ? "border border-brand/40 bg-secondary/60"
                        : "border border-transparent hover:bg-secondary/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(acc.id)}
                      className="flex-1 min-w-0 flex items-center gap-3"
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${colorClass(acc.color)}`}
                      >
                        {getInitial(acc)}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {acc.name}
                      </span>
                    </button>
                    <Link
                      to="/account/$accountId"
                      params={{ accountId: acc.id }}
                      onClick={() => setActive(acc.id)}
                      aria-label={`${acc.name} settings`}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewAccount(true)}
              className="w-9 h-9 rounded-full border border-dashed border-border text-muted-foreground hover:text-brand hover:border-brand transition flex items-center justify-center"
              aria-label="New account"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${colorClass(activeAccount.color)}`}
            >
              {getInitial(activeAccount)}
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <section className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="flex items-center justify-between gap-4 flex-wrap px-6 sm:px-8 pt-6 sm:pt-8 pb-4 max-w-5xl mx-auto w-full shrink-0">
          <nav className="flex items-center gap-1 text-sm">
            {TOP_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition ${
                    isActive
                      ? "bg-secondary text-brand font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(item.i18nKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/account/$accountId"
              params={{ accountId: activeAccount.id }}
              className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm hover:bg-secondary transition"
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colorClass(activeAccount.color)}`}
              >
                {getInitial(activeAccount)}
              </span>
              <span className="font-medium">{activeAccount.name}</span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-secondary/40 text-foreground hover:bg-secondary transition"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 sm:pb-8">
          <div className="max-w-5xl mx-auto w-full">{children}</div>
        </div>
      </section>

      {/* New Account Modal */}
      {showNewAccount && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
          onClick={() => setShowNewAccount(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{t("nav.createNewAccount")}</h2>
              <button
                type="button"
                onClick={() => setShowNewAccount(false)}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label={t("common.close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("nav.nameYourAccount")}
            </p>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAccount()}
              placeholder={`Account ${accounts.length + 1}`}
              className="w-full rounded-full border border-border bg-background dark:bg-background/50 px-5 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
            />
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewAccount(false)}
                className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={createAccount}
                disabled={!newName.trim()}
                className="px-5 py-2 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {t("nav.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
