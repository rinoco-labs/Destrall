import type { SuiChainEnvironment } from "../../config/chains/sui";
import { SUI_WALLET_NAME, suiChainLabelForEnvironment } from "../chains/sui/suiWalletProvider";
import { buildSuiWalletStandardInjectionScript } from "./suiWalletInjection";

export function buildWalletStandardInjectionForNetwork(env: SuiChainEnvironment): string {
  return buildSuiWalletStandardInjectionScript({
    suiChainLabel: suiChainLabelForEnvironment(env),
    walletDisplayName: SUI_WALLET_NAME,
  });
}
