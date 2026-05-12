import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Search,
  Package,
  Star,
  Download,
  CheckCircle2,
  ShieldAlert,
  X,
  User,
  Tag,
  Boxes,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  CATALOG,
  CATEGORIES,
  formatDownloads,
  useInstalled,
  type StorePkg,
} from "@/lib/packages-store";

type Tab = "browse" | "installed";

export const Route = createFileRoute("/store")({
  component: StorePage,
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const t = search.tab;
    return t === "installed" || t === "browse" ? { tab: t } : {};
  },
  head: () => ({
    meta: [
      { title: "Store — Destrall" },
      {
        name: "description",
        content: "Browse and install Destrall packages from the community.",
      },
    ],
  }),
});

function StorePage() {
  const search = Route.useSearch();
  const tab: Tab = search.tab === "installed" ? "installed" : "browse";

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const { installed, toggle } = useInstalled();
  const [active, setActive] = useState<StorePkg | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      tab === "installed"
        ? CATALOG.filter((p) => installed.has(p.id))
        : CATALOG;
    return base.filter((p) => {
      if (tab === "browse" && category !== "All" && p.category !== category)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [query, category, tab, installed]);

  return (
    <AppShell active="store">
      <div className="max-w-5xl mx-auto w-full px-2">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Store</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover packages built by the community to extend your wallet.
          </p>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 p-1 mb-6">
          <Link
            to="/store"
            search={{ tab: "browse" }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              tab === "browse"
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Browse
          </Link>
          <Link
            to="/store"
            search={{ tab: "installed" }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition ${
              tab === "installed"
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            Installed ({installed.size})
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "installed"
                ? "Search installed packages…"
                : "Search packages, authors or categories…"
            }
            className="w-full rounded-full border border-border bg-background/60 pl-11 pr-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
          />
        </div>

        {/* Categories — browse only */}
        {tab === "browse" && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const isActive = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium border transition ${
                    isActive
                      ? "bg-brand text-brand-foreground border-brand"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {tab === "installed" ? `Installed (${installed.size})` : "Browse"}
            </p>
            <span className="text-xs text-muted-foreground">
              {filtered.length} package{filtered.length === 1 ? "" : "s"}
            </span>
          </div>

          {tab === "installed" && installed.size === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-brand/15 text-brand flex items-center justify-center mb-4">
                <Boxes className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium mb-1">No packages installed</p>
              <p className="text-xs text-muted-foreground mb-5">
                Browse the store to extend your wallet with community packages.
              </p>
              <Link
                to="/store"
                search={{ tab: "browse" }}
                className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-semibold hover:opacity-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                Browse Store
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
              {tab === "installed"
                ? "No installed packages match your search."
                : "No packages match your search."}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((p) => (
                <PkgCard
                  key={p.id}
                  pkg={p}
                  installed={installed.has(p.id)}
                  onOpen={() => setActive(p)}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {active && (
        <PkgDetailsModal
          pkg={active}
          installed={installed.has(active.id)}
          onClose={() => setActive(null)}
          onToggle={() => toggle(active.id)}
        />
      )}
    </AppShell>
  );
}

function PkgCard({
  pkg,
  installed,
  onOpen,
  onToggle,
}: {
  pkg: StorePkg;
  installed: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-card/50 p-5 flex flex-col gap-3 hover:border-brand/40 transition cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
          <Package className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{pkg.name}</p>
            <span className="text-xs text-muted-foreground">v{pkg.version}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">by {pkg.author}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{pkg.tagline}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-brand" />
          {pkg.rating.toFixed(1)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Download className="w-3.5 h-3.5" />
          {formatDownloads(pkg.downloads)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Tag className="w-3.5 h-3.5" />
          {pkg.category}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition"
        >
          Details
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 font-semibold transition ${
            installed
              ? "border border-border bg-secondary/40 text-foreground hover:bg-secondary"
              : "bg-brand text-brand-foreground hover:opacity-95"
          }`}
        >
          {installed ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Installed
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Install
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function PkgDetailsModal({
  pkg,
  installed,
  onClose,
  onToggle,
}: {
  pkg: StorePkg;
  installed: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{pkg.name}</h2>
              <p className="text-xs text-muted-foreground truncate">
                v{pkg.version} · {pkg.category}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> {pkg.author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-brand" /> {pkg.rating.toFixed(1)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download className="w-3.5 h-3.5" />
            {formatDownloads(pkg.downloads)} installs
          </span>
        </div>

        <p className="text-sm text-foreground/90 mb-5">{pkg.description}</p>

        <div className="mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Features
          </p>
          <ul className="space-y-1.5">
            {pkg.features.map((f) => (
              <li
                key={f}
                className="text-sm text-foreground/90 flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Permissions
          </p>
          <ul className="rounded-xl border border-amber-500/20 bg-amber-500/5 divide-y divide-amber-500/10 overflow-hidden">
            {pkg.permissions.map((p) => (
              <li key={p} className="px-4 py-2.5 text-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition ${
              installed
                ? "border border-border bg-secondary/40 hover:bg-secondary"
                : "bg-brand text-brand-foreground hover:opacity-95"
            }`}
          >
            {installed ? (
              <>
                <Boxes className="w-4 h-4" />
                Uninstall
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Install Package
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
