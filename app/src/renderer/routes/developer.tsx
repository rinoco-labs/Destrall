import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Upload,
  Package,
  Trash2,
  RefreshCw,
  Store as StoreIcon,
  EyeOff,
  Eye,
  LogIn,
  LogOut,
  UserPlus,
  X,
  CheckCircle2,
  FileCode,
  Code2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/developer")({
  component: DeveloperPage,
  head: () => ({
    meta: [
      { title: "Developer — Destrall" },
      { name: "description", content: "Publish and manage your Destrall packages." },
    ],
  }),
});

type Pkg = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  published: boolean;
};

type AuthMode = "login" | "signup";

function DeveloperPage() {
  const [authed, setAuthed] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Pkg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logout = () => {
    setAuthed(false);
    setEmail("");
    setPwd("");
  };

  const submitAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pwd.trim()) return;
    setAuthed(true);
  };

  const onPickFolder = () => fileInputRef.current?.click();

  const onFolderSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Try to read manifest.json (or package.json) from the folder
    const manifest = files.find((f) =>
      /(^|\/)(manifest|package)\.json$/i.test((f as any).webkitRelativePath || f.name),
    );

    const fallbackName =
      ((files[0] as any).webkitRelativePath || "").split("/")[0] || "Untitled Package";

    const finalize = (data: Partial<Pkg>) => {
      const pkg: Pkg = {
        id: crypto.randomUUID(),
        name: data.name || fallbackName,
        version: data.version || "0.1.0",
        description: data.description || "",
        author: data.author || "",
        published: false,
      };
      setEditing(pkg);
    };

    if (manifest) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const m = JSON.parse(String(reader.result || "{}"));
          finalize({
            name: m.name,
            version: m.version,
            description: m.description,
            author: typeof m.author === "string" ? m.author : m.author?.name,
          });
        } catch {
          finalize({});
        }
      };
      reader.readAsText(manifest);
    } else {
      finalize({});
    }

    e.target.value = "";
  };

  const savePkg = () => {
    if (!editing) return;
    setPackages((prev) => {
      const exists = prev.some((p) => p.id === editing.id);
      return exists
        ? prev.map((p) => (p.id === editing.id ? editing : p))
        : [...prev, editing];
    });
    setEditing(null);
  };

  const deletePkg = (id: string) => {
    setPackages((p) => p.filter((x) => x.id !== id));
  };

  const togglePublished = (id: string) => {
    setPackages((p) =>
      p.map((x) => (x.id === id ? { ...x, published: !x.published } : x)),
    );
  };

  return (
    <AppShell active="developer">
      <div className="max-w-3xl mx-auto w-full px-2">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Developer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish and manage your Destrall packages.
          </p>
          {authed && (
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              <button
                type="button"
                onClick={onPickFolder}
                className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground font-semibold px-5 py-2.5 hover:opacity-95 transition"
              >
                <Upload className="w-4 h-4" />
                Upload Package
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full border border-destructive/30 text-destructive font-semibold px-4 py-2.5 hover:bg-destructive/10 transition"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          )}
        </div>

        {!authed ? (
          <div className="relative max-w-md mx-auto mt-6">
            <div
              className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-white/10 via-primary/5 to-accent/10 backdrop-blur-2xl p-8 text-center"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="relative">
                <h2 className="text-2xl font-bold tracking-tight">
                  {authMode === "login" ? "Welcome Back, Developer" : "Join as a Developer"}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  {authMode === "login"
                    ? "Sign in to publish and manage your packages."
                    : "Create an account to start shipping packages to the store."}
                </p>

                <div className="flex items-center gap-1 mb-5 rounded-full border border-border/60 bg-white/5 backdrop-blur p-1">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition ${
                  authMode === "login"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LogIn className="w-4 h-4" />
                Log In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2 text-sm font-medium transition ${
                  authMode === "signup"
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Sign Up
              </button>
            </div>

            <form onSubmit={submitAuth} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@developer.com"
                className="w-full rounded-full border border-border bg-white/10 px-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
              />
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-full border border-border bg-white/10 px-5 py-3 pr-12 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!email.trim() || !pwd.trim()}
                className="w-full rounded-full bg-brand text-brand-foreground font-semibold py-3 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {authMode === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
              </div>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              // @ts-expect-error non-standard but supported in Chromium-based browsers
              webkitdirectory=""
              directory=""
              multiple
              onChange={onFolderSelected}
            />

            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
              Your Packages
            </p>

            {packages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-brand/15 text-brand flex items-center justify-center mx-auto mb-4">
                  <Package className="w-6 h-6" />
                </div>
                <p className="font-semibold mb-1">No packages yet</p>
                <p className="text-sm text-muted-foreground mb-5">
                  Upload a folder from your computer to get started.
                  We'll read the manifest if one exists.
                </p>
                <button
                  type="button"
                  onClick={onPickFolder}
                  className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground font-semibold px-5 py-2.5 hover:opacity-95 transition"
                >
                  <Upload className="w-4 h-4" />
                  Upload Package
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="rounded-2xl border border-border bg-card/50 p-5 flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{pkg.name}</p>
                        <span className="text-xs text-muted-foreground">v{pkg.version}</span>
                        {pkg.published && (
                          <span className="inline-flex items-center gap-1 text-xs text-brand">
                            <CheckCircle2 className="w-3 h-3" />
                            Published
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {pkg.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setEditing(pkg)}
                          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border bg-secondary/40 hover:bg-secondary px-3 py-1.5 transition"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          Edit Details
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePublished(pkg.id)}
                          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border bg-secondary/40 hover:bg-secondary px-3 py-1.5 transition"
                        >
                          <StoreIcon className="w-3.5 h-3.5" />
                          {pkg.published ? "Remove from Store" : "Publish to Store"}
                        </button>
                        <button
                          type="button"
                          onClick={onPickFolder}
                          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-border bg-secondary/40 hover:bg-secondary px-3 py-1.5 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(pkg)}
                          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 px-3 py-1.5 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
          onClick={() => setEditing(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Package Details</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Confirm the details below. Fields are pre-filled from your manifest when available.
            </p>
            <div className="space-y-3">
              <Field label="Name">
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-full border border-border bg-background/60 px-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
                />
              </Field>
              <Field label="Version">
                <input
                  type="text"
                  value={editing.version}
                  onChange={(e) => setEditing({ ...editing, version: e.target.value })}
                  className="w-full rounded-full border border-border bg-background/60 px-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
                />
              </Field>
              <Field label="Author">
                <input
                  type="text"
                  value={editing.author}
                  onChange={(e) => setEditing({ ...editing, author: e.target.value })}
                  className="w-full rounded-full border border-border bg-background/60 px-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-border bg-background/60 px-5 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition resize-none"
                />
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePkg}
                disabled={!editing.name.trim()}
                className="px-5 py-2 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Save Package
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold mb-1">Delete package?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete{" "}
              <span className="text-foreground font-medium">{confirmDelete.name}</span>. This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-full border border-border text-sm hover:bg-secondary/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePkg(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-95 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground px-1">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
