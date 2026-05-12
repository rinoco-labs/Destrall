// Lightweight client-side store for contacts and activity.
// Uses localStorage so data persists across reloads in the demo wallet.

export type Contact = { id: string; name: string; address: string };
export type ActivityKind = "send" | "receive" | "swap";
export type Activity = {
  id: string;
  kind: ActivityKind;
  token: string;
  amount: number;
  counterparty: string; // address or name
  timestamp: number;
  status: "completed" | "pending";
};

const CONTACTS_KEY = "destrall.contacts";
const ACTIVITY_KEY = "destrall.activity";

export const WALLET_ADDRESS =
  "0x7A3f9C2eD4b8F1aA92cE6BdB0c5A4d3E2F1a90Bc";

export function loadContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export function loadActivity(): Activity[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveActivity(items: Activity[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items));
}

export function addActivity(a: Omit<Activity, "id" | "timestamp">) {
  const next: Activity = {
    ...a,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  const list = loadActivity();
  list.unshift(next);
  saveActivity(list);
  return next;
}

export const TOKENS = [
  { symbol: "SOL", name: "Solana", balance: 0 },
  { symbol: "SUI", name: "Sui", balance: 0 },
  { symbol: "USDC", name: "USD Coin", balance: 0 },
];

export function shortAddr(addr: string, head = 6, tail = 4) {
  if (!addr) return "";
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
