// Shared catalog + installed-state store for Destrall packages.
import { useEffect, useState } from "react";

export type StorePkg = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  author: string;
  version: string;
  category: string;
  downloads: number;
  rating: number;
  permissions: string[];
  features: string[];
};

export const CATALOG: StorePkg[] = [
  {
    id: "navi-lend",
    name: "Navi Lending",
    tagline: "Supply and borrow on Navi Protocol",
    description:
      "Lend your idle assets and borrow against your collateral on Navi, the leading lending market on Sui. Includes one-click supply, repay, and health-factor monitoring.",
    author: "navi.labs",
    version: "1.4.2",
    category: "DeFi",
    downloads: 12480,
    rating: 4.8,
    permissions: [
      "Read wallet balances",
      "Sign transactions for Navi contracts",
      "Read on-chain price feeds",
    ],
    features: [
      "Supply and borrow assets on Navi",
      "Track health factor in real-time",
      "Auto-repay suggestions from the assistant",
    ],
  },
  {
    id: "cetus-swap",
    name: "Cetus Swap",
    tagline: "Best-route swaps on Cetus DEX",
    description:
      "Swap any supported token through Cetus concentrated liquidity pools with smart routing for the best price.",
    author: "cetus.protocol",
    version: "2.1.0",
    category: "DeFi",
    downloads: 22130,
    rating: 4.9,
    permissions: [
      "Read wallet balances",
      "Sign swap transactions",
      "Query pool state",
    ],
    features: [
      "Smart routing across pools",
      "Slippage and price-impact warnings",
      "Token allowlist enforcement",
    ],
  },
  {
    id: "scallop-yields",
    name: "Scallop Yields",
    tagline: "Auto-compound your Scallop positions",
    description:
      "Track and auto-compound yield positions on Scallop. Get notified when rates change significantly.",
    author: "scallop.io",
    version: "0.9.5",
    category: "DeFi",
    downloads: 5310,
    rating: 4.6,
    permissions: ["Read positions", "Sign compound transactions"],
    features: ["One-click compound", "Yield change alerts", "Position history"],
  },
  {
    id: "suins-manager",
    name: "SuiNS Manager",
    tagline: "Register and manage .sui names",
    description:
      "Search, register, renew, and point .sui names to addresses without leaving Destrall.",
    author: "suins.io",
    version: "1.0.3",
    category: "Identity",
    downloads: 8900,
    rating: 4.7,
    permissions: ["Sign SuiNS transactions", "Read wallet address"],
    features: [
      "Name search & registration",
      "Reverse-resolution display",
      "Renewal reminders",
    ],
  },
  {
    id: "nft-gallery",
    name: "NFT Gallery",
    tagline: "Beautiful gallery for your Sui NFTs",
    description:
      "Display, organize and share your NFT collection. Supports collections, traits and rarity views.",
    author: "studio.pixel",
    version: "1.2.0",
    category: "NFTs",
    downloads: 3420,
    rating: 4.4,
    permissions: ["Read NFT objects from wallet"],
    features: ["Collection grouping", "Trait filters", "Shareable gallery link"],
  },
  {
    id: "tx-explorer",
    name: "Tx Explorer",
    tagline: "Inline transaction explorer",
    description:
      "Inspect transactions, decode Move calls and view object changes inside your wallet.",
    author: "destrall.tools",
    version: "0.7.1",
    category: "Tools",
    downloads: 1820,
    rating: 4.3,
    permissions: ["Read transaction history"],
    features: ["Move call decoder", "Object diff viewer", "Gas breakdown"],
  },
];

export const CATEGORIES = ["All", "DeFi", "NFTs", "Identity", "Tools"];

const KEY = "destrall.installed";
const DEFAULT_INSTALLED = ["cetus-swap", "suins-manager"];

function readInstalled(): Set<string> {
  if (typeof window === "undefined") return new Set(DEFAULT_INSTALLED);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set(DEFAULT_INSTALLED);
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(DEFAULT_INSTALLED);
  }
}

const listeners = new Set<() => void>();
let current: Set<string> = readInstalled();

function emit() {
  for (const l of listeners) l();
}

export function useInstalled() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    // refresh in case of SSR/hydration mismatch
    current = readInstalled();
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    installed: current,
    toggle: (id: string) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      current = next;
      if (typeof window !== "undefined") {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      }
      emit();
    },
  };
}

export function formatDownloads(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
