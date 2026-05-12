import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Send, Trash2, Users, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  Contact,
  loadContacts,
  saveContacts,
  shortAddr,
} from "@/lib/wallet-store";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
  head: () => ({
    meta: [
      { title: "Contacts — Destrall" },
      { name: "description", content: "Manage your wallet contacts." },
    ],
  }),
});

function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Contact | null>(null);

  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const persist = (next: Contact[]) => {
    setContacts(next);
    saveContacts(next);
  };

  const openNew = () => {
    setEditing(null);
    setName("");
    setAddress("");
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setName(c.name);
    setAddress(c.address);
    setShowForm(true);
  };

  const save = () => {
    const n = name.trim();
    const a = address.trim();
    if (!n || !a) return;
    if (editing) {
      persist(contacts.map((c) => (c.id === editing.id ? { ...c, name: n, address: a } : c)));
    } else {
      persist([...contacts, { id: crypto.randomUUID(), name: n, address: a }]);
    }
    setShowForm(false);
  };

  const remove = (c: Contact) => {
    persist(contacts.filter((x) => x.id !== c.id));
    setConfirmDelete(null);
  };

  return (
    <AppShell active="home">
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-semibold hover:opacity-95 transition"
          >
            <Plus className="w-4 h-4" />
            Add contact
          </button>
        </div>

        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-3">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-semibold">No contacts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a contact to send tokens faster next time.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur divide-y divide-border overflow-hidden">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <span className="w-10 h-10 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {shortAddr(c.address, 10, 6)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({
                        to: "/send",
                        search: { to: c.address, name: c.name },
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 text-brand px-3 py-1.5 text-xs font-semibold hover:bg-brand/25 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition flex items-center justify-center"
                    aria-label="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(c)}
                    className="w-8 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition flex items-center justify-center"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={editing ? "Edit contact" : "Add contact"}>
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Name
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex"
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 focus:outline-none focus:border-brand/60 transition"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Wallet address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 focus:outline-none focus:border-brand/60 transition font-mono text-sm"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || !address.trim()}
              className="px-5 py-2 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {editing ? "Save changes" : "Add contact"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} title="Delete contact?">
          <p className="text-sm text-muted-foreground">
            This will permanently remove{" "}
            <span className="text-foreground font-medium">{confirmDelete.name}</span> from your
            contacts.
          </p>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => remove(confirmDelete)}
              className="px-5 py-2 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-background/70 backdrop-blur-sm px-4 py-6 overflow-y-auto overscroll-contain"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
