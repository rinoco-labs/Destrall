import type { ChainId } from "../../../shared/wallet/types";

export type BrowserDappCategory =
  | "trading"
  | "defi"
  | "yield"
  | "nfts"
  | "infrastructure"
  | "tools";

export type BrowserDappDefinition = {
  id: string;
  name: string;
  description: string;
  url: string;
  category: BrowserDappCategory;
  /** Optional remote icon; falls back to initials if load fails */
  iconUrl?: string;
  verified?: boolean;
};

export type BrowserDappSection = {
  category: BrowserDappCategory;
  title: string;
  dapps: BrowserDappDefinition[];
};

export type BrowserChainDappCatalog = {
  chainId: ChainId;
  label: string;
  dapps: BrowserDappDefinition[];
};

export const BROWSER_DAPP_CATEGORY_LABELS: Record<BrowserDappCategory, string> = {
  trading: "Trading",
  defi: "DeFi",
  yield: "Yield / Lending",
  nfts: "NFTs",
  infrastructure: "Infrastructure",
  tools: "Tools",
};

export const BROWSER_DAPP_SECTION_ORDER: BrowserDappCategory[] = [
  "trading",
  "defi",
  "yield",
  "nfts",
  "infrastructure",
  "tools",
];
