import type { TokenBalanceView } from "../../types/blockchain";
import type { WalletAccount } from "../../shared/wallet/types";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { chainFacadeService } from "../../main/services/chains/chainFacadeService";
import { walletService } from "../../main/wallet/walletService";
import { networkSettingsService } from "../../main/services/network/networkSettingsService";
import { contactRepository } from "../../main/persistence/repositories/contactRepository";
import type { ContactEntity } from "../../main/persistence/repositories/contactRepository";

export type ScopedContact = Pick<ContactEntity, "id" | "name" | "address">;

export type ActionContext = {
  /** Active assistant / wallet account this turn is scoped to. */
  accountId: string;
  wallet: {
    getActiveAccount(): WalletAccount | null;
    getBalances(): Promise<TokenBalanceView[]>;
    listOtherSuiAccounts(): Array<{ id: string; name: string; address: string }>;
    prepareSendTransaction(params: {
      recipient: string;
      coinType: string;
      amountDisplay: string;
    }): ReturnType<typeof chainFacadeService.prepareTransfer>;
  };
  contacts: {
    searchContacts(query: string): Promise<ScopedContact[]>;
  };
  network: {
    getActiveNetwork(): { environment: SuiChainEnvironment; displayName: string };
  };
  tokens: {
    resolveTokenSymbol(symbol: string, balances: TokenBalanceView[]): string | null;
  };
};

function networkDisplay(env: SuiChainEnvironment): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}

function contactInScope(c: ContactEntity, accountId: string): boolean {
  if (c.chain !== "sui") return false;
  if (c.accountId != null && c.accountId !== accountId) return false;
  return true;
}

function resolveTokenSymbol(symbol: string, balances: TokenBalanceView[]): string | null {
  const u = symbol.trim().toUpperCase();
  const row = balances.find((b) => b.symbol.toUpperCase() === u);
  return row?.coinType ?? null;
}

/**
 * Safe capabilities for package actions. No mnemonic, private keys, PIN, or signers.
 */
export function createActionContext(accountId: string): ActionContext {
  return {
    accountId,
    wallet: {
      getActiveAccount: () => walletService.getWalletAccount(accountId),
      getBalances: () => chainFacadeService.getTokenBalances(accountId),
      listOtherSuiAccounts: () => {
        const snap = walletService.getStatus();
        return snap.accounts
          .filter((a) => a.chain === "sui" && a.id !== accountId)
          .map((a) => ({ id: a.id, name: a.name, address: a.address }));
      },
      prepareSendTransaction: ({ recipient, coinType, amountDisplay }) =>
        chainFacadeService.prepareTransfer({
          accountId,
          recipient,
          coinType,
          amountDisplay,
        }),
    },
    contacts: {
      searchContacts: async (query: string) => {
        const rows = contactRepository.list(query);
        return rows
          .filter((c) => contactInScope(c, accountId))
          .map((c) => ({ id: c.id, name: c.name, address: c.address }));
      },
    },
    network: {
      getActiveNetwork: () => {
        const env = networkSettingsService.getSuiEnvironment();
        return { environment: env, displayName: networkDisplay(env) };
      },
    },
    tokens: {
      resolveTokenSymbol,
    },
  };
}
