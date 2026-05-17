import type { ChainId } from "../../../shared/wallet/types";
import { ETHEREUM_DAPPS } from "./ethereum";
import { SOLANA_DAPPS } from "./solana";
import { SUI_DAPPS } from "./sui";
import {
  BROWSER_DAPP_CATEGORY_LABELS,
  BROWSER_DAPP_SECTION_ORDER,
  type BrowserChainDappCatalog,
  type BrowserDappCategory,
  type BrowserDappDefinition,
  type BrowserDappSection,
} from "./types";

export {
  BROWSER_DAPP_CATEGORY_LABELS,
  BROWSER_DAPP_SECTION_ORDER,
  type BrowserChainDappCatalog,
  type BrowserDappCategory,
  type BrowserDappDefinition,
  type BrowserDappSection,
};

const CATALOGS: Record<ChainId, BrowserChainDappCatalog> = {
  sui: { chainId: "sui", label: "Sui", dapps: SUI_DAPPS },
  solana: { chainId: "solana", label: "Solana", dapps: SOLANA_DAPPS },
  evm: { chainId: "evm", label: "Ethereum", dapps: ETHEREUM_DAPPS },
};

export function getBrowserDappCatalog(chainId: ChainId): BrowserChainDappCatalog {
  return CATALOGS[chainId] ?? CATALOGS.sui;
}

export function getBrowserDappsForChain(chainId: ChainId): BrowserDappDefinition[] {
  return getBrowserDappCatalog(chainId).dapps;
}

export function getBrowserDappById(
  chainId: ChainId,
  dappId: string,
): BrowserDappDefinition | undefined {
  return getBrowserDappsForChain(chainId).find((dapp) => dapp.id === dappId);
}

export function groupDappsIntoSections(dapps: BrowserDappDefinition[]): BrowserDappSection[] {
  const byCategory = new Map<BrowserDappCategory, BrowserDappDefinition[]>();
  for (const dapp of dapps) {
    const list = byCategory.get(dapp.category) ?? [];
    list.push(dapp);
    byCategory.set(dapp.category, list);
  }
  return BROWSER_DAPP_SECTION_ORDER.filter((category) => byCategory.has(category)).map(
    (category) => ({
      category,
      title: BROWSER_DAPP_CATEGORY_LABELS[category],
      dapps: byCategory.get(category) ?? [],
    }),
  );
}
