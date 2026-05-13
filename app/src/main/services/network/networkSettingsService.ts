import { getDatabase } from "../../persistence/database";
import type { ChainId } from "../../../shared/wallet/types";
import type { SuiChainEnvironment } from "../../../config/chains/sui";
import { getSuiNetworkDefinition } from "../../../config/chains/sui";
import type { NetworkUiSnapshot } from "../../../types/blockchain";

const ACTIVE_CHAIN_KEY = "network_active_chain";
const SUI_ENV_KEY = "network_sui_environment";

const DEFAULT_CHAIN: ChainId = "sui";
const DEFAULT_SUI_ENV: SuiChainEnvironment = "mainnet";

class NetworkSettingsService {
  private getValue(key: string): string | null {
    const row = getDatabase()
      .prepare(`SELECT value FROM app_settings WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setValue(key: string, value: string) {
    const now = Date.now();
    getDatabase()
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now);
  }

  getActiveChain(): ChainId {
    const raw = this.getValue(ACTIVE_CHAIN_KEY);
    if (raw === "sui" || raw === "solana" || raw === "evm") return raw;
    return DEFAULT_CHAIN;
  }

  getSuiEnvironment(): SuiChainEnvironment {
    const raw = this.getValue(SUI_ENV_KEY);
    if (raw === "mainnet" || raw === "testnet" || raw === "devnet") return raw;
    return DEFAULT_SUI_ENV;
  }

  setSuiEnvironment(env: SuiChainEnvironment) {
    this.setValue(SUI_ENV_KEY, env);
  }

  setActiveChain(chain: ChainId) {
    this.setValue(ACTIVE_CHAIN_KEY, chain);
  }

  getSnapshot(): NetworkUiSnapshot {
    const activeChain = this.getActiveChain();
    const activeEnvironment = this.getSuiEnvironment();
    const sui = getSuiNetworkDefinition(activeEnvironment);
    return {
      activeChain,
      activeEnvironment,
      rpcUrl: sui.rpcUrl,
      explorerBaseUrl: sui.explorerBaseUrl,
      chainIdLabel: sui.chainIdLabel,
    };
  }

  initializeNetworkState() {
    if (!this.getValue(ACTIVE_CHAIN_KEY)) {
      this.setValue(ACTIVE_CHAIN_KEY, DEFAULT_CHAIN);
    }
    if (!this.getValue(SUI_ENV_KEY)) {
      this.setValue(SUI_ENV_KEY, DEFAULT_SUI_ENV);
    }
  }
}

export const networkSettingsService = new NetworkSettingsService();
