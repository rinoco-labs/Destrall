import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AccountIcon = string; // single emoji or letter

export type Account = {
  id: string;
  name: string;
  icon: AccountIcon; // emoji or single letter (empty => derive from name)
  color: string; // tailwind-like token name we map to a class, or hex; we'll use a small palette key
  hideBalance: boolean;
  notifications: boolean;
  defaultForSend: boolean;
  createdAt: number;
};

export const ACCOUNT_COLORS = [
  { key: "brand", label: "Brand", className: "bg-brand/20 text-brand" },
  { key: "violet", label: "Violet", className: "bg-violet-500/20 text-violet-400" },
  { key: "emerald", label: "Emerald", className: "bg-emerald-500/20 text-emerald-400" },
  { key: "amber", label: "Amber", className: "bg-amber-500/20 text-amber-400" },
  { key: "rose", label: "Rose", className: "bg-rose-500/20 text-rose-400" },
  { key: "sky", label: "Sky", className: "bg-sky-500/20 text-sky-400" },
] as const;

export type AccountColorKey = (typeof ACCOUNT_COLORS)[number]["key"];

export function colorClass(key: string) {
  return (
    ACCOUNT_COLORS.find((c) => c.key === key)?.className ??
    ACCOUNT_COLORS[0].className
  );
}

type State = {
  accounts: Account[];
  activeAccountId: string;
  addAccount: (name: string) => Account;
  removeAccount: (id: string) => void;
  setActive: (id: string) => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id" | "createdAt">>) => void;
};

const defaultAccount: Account = {
  id: "acc_default",
  name: "Account 1",
  icon: "",
  color: "brand",
  hideBalance: false,
  notifications: true,
  defaultForSend: true,
  createdAt: Date.now(),
};

export const useAccountsStore = create<State>()(
  persist(
    (set, get) => ({
      accounts: [defaultAccount],
      activeAccountId: defaultAccount.id,
      addAccount: (name) => {
        const acc: Account = {
          id: `acc_${crypto.randomUUID().slice(0, 8)}`,
          name,
          icon: "",
          color:
            ACCOUNT_COLORS[get().accounts.length % ACCOUNT_COLORS.length].key,
          hideBalance: false,
          notifications: true,
          defaultForSend: false,
          createdAt: Date.now(),
        };
        set((s) => ({
          accounts: [...s.accounts, acc],
          activeAccountId: acc.id,
        }));
        return acc;
      },
      removeAccount: (id) =>
        set((s) => {
          const accounts = s.accounts.filter((a) => a.id !== id);
          const safeAccounts =
            accounts.length === 0 ? [defaultAccount] : accounts;
          return {
            accounts: safeAccounts,
            activeAccountId:
              s.activeAccountId === id
                ? safeAccounts[0].id
                : s.activeAccountId,
          };
        }),
      setActive: (id) => set({ activeAccountId: id }),
      updateAccount: (id, patch) =>
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),
    }),
    {
      name: "destrall.accounts",
      storage: createJSONStorage(() =>
        typeof window === "undefined"
          ? (undefined as unknown as Storage)
          : localStorage,
      ),
    },
  ),
);

export function getInitial(acc: Pick<Account, "name" | "icon">) {
  if (acc.icon) return acc.icon;
  return acc.name.charAt(0).toUpperCase() || "?";
}
