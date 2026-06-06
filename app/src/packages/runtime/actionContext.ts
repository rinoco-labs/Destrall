import type { TokenBalanceView } from "../../types/blockchain";
import type { WalletAccount } from "../../shared/wallet/types";
import type { SuiChainEnvironment } from "../../config/chains/sui";
import { chainFacadeService } from "../../main/services/chains/chainFacadeService";
import { walletService } from "../../main/wallet/walletService";
import { networkSettingsService } from "../../main/services/network/networkSettingsService";
import { contactRepository } from "../../main/persistence/repositories/contactRepository";
import type { ContactEntity } from "../../main/persistence/repositories/contactRepository";
import { isContactVisibleInWallet, walletAccountIdSet } from "../../services/contacts/contactScope";
import {
  resolveWalletToken,
  type ResolveWalletTokenResult,
} from "../../services/tokens/walletTokenResolver";

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
      walletDecimals?: number;
      walletBalanceRaw?: string;
      walletSymbol?: string;
    }): ReturnType<typeof chainFacadeService.prepareTransfer>;
  };
  contacts: {
    searchContacts(query: string): Promise<ScopedContact[]>;
  };
  network: {
    getActiveNetwork(): { environment: SuiChainEnvironment; displayName: string };
  };
  tokens: {
    /** @deprecated Prefer resolveWalletToken for full ambiguity / error handling. */
    resolveTokenSymbol(symbol: string, balances: TokenBalanceView[]): string | null;
    resolveWalletToken(
      input: string,
      balances: TokenBalanceView[],
      options?: { requirePositiveBalance?: boolean },
    ): ResolveWalletTokenResult;
  };
};

function networkDisplay(env: SuiChainEnvironment): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}

function resolveTokenSymbol(symbol: string, balances: TokenBalanceView[]): string | null {
  const result = resolveWalletToken(symbol, balances, { requirePositiveBalance: true });
  return result.kind === "resolved" ? result.balance.coinType : null;
}

/**
 * Safe capabilities for package actions. No mnemonic, private keys, PIN, or signers.
 */
export function createActionContext(accountId: string): ActionContext {
  const account = walletService.getWalletAccount(accountId);
  const walletAddress = account?.address;

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
      prepareSendTransaction: ({
        recipient,
        coinType,
        amountDisplay,
        walletDecimals,
        walletBalanceRaw,
        walletSymbol,
      }) =>
        chainFacadeService.prepareTransfer({
          accountId,
          recipient,
          coinType,
          amountDisplay,
          walletDecimals,
          walletBalanceRaw,
          walletSymbol,
        }),
    },
    contacts: {
      searchContacts: async (query: string) => {
        const walletAccounts = walletAccountIdSet();
        const rows = contactRepository.list(query);
        return rows
          .filter((c) => isContactVisibleInWallet(c, walletAccounts))
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
      resolveWalletToken: (input, balances, options) =>
        resolveWalletToken(input, balances, {
          ...options,
          walletAddress,
          logContext: `account:${accountId}`,
        }),
    },
  };
}
