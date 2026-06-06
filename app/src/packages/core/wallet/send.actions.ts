import { randomUUID } from "node:crypto";
import type { AssistantProposalCard, AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import type { SendProposalSnapshot } from "../../runtime/transactionProposalTypes";
import { parseOtherAccountRecipient } from "../../../services/contacts/contactResolutionService";
import { resolveSendRecipient } from "../../../services/contacts/recipientResolutionService";
import { validateSpendAmount, shortenCoinType, getTokenDecimalsFromBalance } from "../../../services/tokens/balanceValidation";
import { findWalletBalanceByCoinType } from "../../../services/tokens/walletTokenResolver";
import { logTokenAmountConversion } from "../../../shared/tokens/amounts";

function asTrimmedString(v: unknown, field: string): string {
  if (typeof v !== "string") {
    throw new Error(`Invalid ${field}`);
  }
  const s = v.trim();
  if (!s) {
    throw new Error(`${field} is required`);
  }
  return s;
}

function buildSendCard(params: {
  requestedToken: string;
  resolvedBalance: { symbol: string; balanceFormatted: string; coinType: string; decimals: number };
  summary: {
    symbol: string;
    amountFormatted: string;
    recipient: string;
    gasBudgetFormatted: string;
    decimals: number;
  };
  network: string;
  fromAccountLabel: string;
  recipientDisplayName?: string;
  amountRaw: string;
  warnings: string[];
}): AssistantProposalCard {
  const toLabel = params.recipientDisplayName
    ? `${params.recipientDisplayName} (${params.summary.recipient.slice(0, 10)}…${params.summary.recipient.slice(-6)})`
    : params.summary.recipient;

  const noteLines = [
    "Confirm only if the recipient and amount are correct. Unlock your wallet before approving.",
    ...params.warnings,
  ];

  return {
    title: "Send",
    label: params.recipientDisplayName
      ? `Send ${params.summary.amountFormatted} ${params.summary.symbol} to ${params.recipientDisplayName}`
      : `Send ${params.summary.amountFormatted} ${params.summary.symbol}`,
    source: { type: "core", name: "Destrall Wallet" },
    flows: [
      {
        direction: "out",
        amount: params.summary.amountFormatted,
        token: params.summary.symbol,
        kind: "token",
      },
    ],
    details: [
      { k: "Action", v: "Sui transfer" },
      { k: "Requested token", v: params.requestedToken },
      { k: "Resolved token", v: params.resolvedBalance.symbol },
      { k: "Decimals", v: String(params.summary.decimals) },
      { k: "Wallet balance", v: `${params.resolvedBalance.balanceFormatted} ${params.resolvedBalance.symbol}` },
      { k: "Coin type", v: shortenCoinType(params.resolvedBalance.coinType) },
      { k: "Amount", v: `${params.summary.amountFormatted} ${params.summary.symbol}` },
      { k: "Amount (raw)", v: params.amountRaw },
      { k: "To", v: toLabel },
      { k: "Recipient address", v: params.summary.recipient },
      { k: "From", v: params.fromAccountLabel },
      { k: "Network", v: params.network },
      { k: "Network fee (est.)", v: `~${params.summary.gasBudgetFormatted} SUI` },
      {
        k: "Outcome",
        v: `Send ${params.summary.amountFormatted} ${params.summary.symbol} to the recipient address.`,
      },
    ],
    note: noteLines.join(" "),
  };
}

/**
 * Prepare-only send: resolves token, recipient, balances, and gas off-chain; never signs.
 */
export async function prepareSendAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const token = asTrimmedString(input.token, "token");
  const amount = asTrimmedString(input.amount, "amount");
  let recipient = asTrimmedString(input.recipient, "recipient");
  const coinTypeOverride = typeof input.coinType === "string" ? input.coinType.trim() : undefined;

  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts support sends from the assistant.", code: "unsupported_chain" }];
  }

  const balances = await ctx.wallet.getBalances();

  let resolvedBalance;
  if (coinTypeOverride) {
    const row = findWalletBalanceByCoinType(balances, coinTypeOverride);
    if (!row) {
      return [
        {
          type: "error",
          message: `The selected token is not in the currently connected wallet. Switch accounts or deposit the token first.`,
          code: "unknown_token",
        },
      ];
    }
    resolvedBalance = { balance: row, userInput: token, matchReason: "user_pick" };
  } else {
    const tokenResult = ctx.tokens.resolveWalletToken(token, balances, { requirePositiveBalance: true });
    if (tokenResult.kind === "not_found") {
      return [{ type: "error", message: tokenResult.message, code: "unknown_token" }];
    }
    if (tokenResult.kind === "ambiguous") {
      return [
        {
          type: "token_disambiguation",
          disambiguationId: randomUUID(),
          action: "send",
          userInput: token,
          pendingInput: { token, amount, recipient },
          matches: tokenResult.candidates.map((c) => ({
            coinType: c.coinType,
            symbol: c.symbol,
            balanceFormatted: c.balanceFormatted,
            source: "wallet" as const,
          })),
        },
      ];
    }
    resolvedBalance = tokenResult;
  }

  const spendCheck = validateSpendAmount({
    amountDisplay: amount,
    balance: resolvedBalance.balance,
    actionLabel: "This send",
  });
  if (!spendCheck.ok) {
    return [{ type: "error", message: spendCheck.message, code: spendCheck.code }];
  }

  let walletDecimals: number;
  try {
    walletDecimals = getTokenDecimalsFromBalance(resolvedBalance.balance);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load decimals for this token. Refresh balances and try again.";
    return [{ type: "error", message: msg, code: "decimals_unresolved" }];
  }

  logTokenAmountConversion({
    context: "assistant-send",
    tokenInput: token,
    resolvedSymbol: resolvedBalance.balance.symbol,
    coinType: resolvedBalance.balance.coinType,
    decimals: walletDecimals,
    humanAmount: amount,
    rawAmount: spendCheck.amountRaw.toString(),
    balanceRaw: resolvedBalance.balance.balanceRaw,
    validation: "prepared",
  });

  const net = ctx.network.getActiveNetwork();
  const contacts = await ctx.contacts.searchContacts("");
  const otherAccounts = ctx.wallet.listOtherSuiAccounts();

  let recipientDisplayName: string | undefined;
  const otherMarker = parseOtherAccountRecipient(recipient);
  if (otherMarker) {
    recipient = `__OTHER_ACCOUNT__:${otherMarker.nameHint}`;
  }

  const resolved = await resolveSendRecipient({
    recipient,
    contacts,
    otherAccounts,
    suiEnvironment: net.environment,
  });

  if (resolved.kind === "ambiguous_contact" || resolved.kind === "ambiguous_account") {
    const matches = resolved.matches.map((m) => ({ id: m.id, name: m.name, address: m.address }));
    return [
      {
        type: "contact_disambiguation",
        disambiguationId: randomUUID(),
        token,
        amount,
        originalRecipientQuery: resolved.query,
        matches,
      },
    ];
  }

  if (resolved.kind === "invalid_contact_address") {
    return [
      {
        type: "error",
        message: `Contact "${resolved.contact.name}" does not have a valid Sui address or SuiNS name. Update it on the Contacts screen, then try again.`,
        code: "invalid_contact_address",
      },
    ];
  }

  if (resolved.kind === "none") {
    return [
      {
        type: "error",
        message: `Could not resolve "${resolved.query}" to a recipient. Use a full Sui address (0x…), a saved contact name from Contacts, or a registered SuiNS name (e.g. name.sui).`,
        code: "unknown_recipient",
      },
    ];
  }

  let recipientAddress: string;
  if (resolved.kind === "sui_address") {
    recipientAddress = resolved.address;
  } else if (resolved.kind === "suins_name") {
    recipientDisplayName = resolved.displayName;
    recipientAddress = resolved.address;
  } else {
    recipientDisplayName = resolved.contact.name;
    recipientAddress = resolved.address;
  }

  if (recipientAddress === account.address) {
    return [{ type: "error", message: "Cannot send to the same address as this account.", code: "self_send" }];
  }

  const warnings: string[] = [];
  const coinType = resolvedBalance.balance.coinType;

  try {
    const prep = await ctx.wallet.prepareSendTransaction({
      recipient: recipientAddress,
      coinType,
      amountDisplay: amount,
      walletDecimals,
      walletBalanceRaw: resolvedBalance.balance.balanceRaw,
      walletSymbol: resolvedBalance.balance.symbol,
    });
    const { summary } = prep;

    const snapshot: SendProposalSnapshot = {
      accountId: ctx.accountId,
      suiEnvironment: net.environment,
      senderAddress: account.address,
      recipientAddress: summary.recipient,
      coinType: summary.coinType,
      amountDisplay: amount,
      decimals: walletDecimals,
      walletBalanceRaw: resolvedBalance.balance.balanceRaw,
      symbol: resolvedBalance.balance.symbol,
    };

    const card = buildSendCard({
      requestedToken: token,
      resolvedBalance: resolvedBalance.balance,
      summary: {
        symbol: summary.symbol,
        amountFormatted: summary.amountFormatted,
        recipient: summary.recipient,
        gasBudgetFormatted: summary.gasBudgetFormatted,
        decimals: summary.decimals,
      },
      network: net.displayName,
      fromAccountLabel: `${account.name} (${account.address.slice(0, 8)}…)`,
      recipientDisplayName,
      amountRaw: summary.amountRaw,
      warnings,
    });

    const proposalId = randomUUID();
    return [
      {
        type: "send_proposal",
        proposalId,
        status: "pending",
        transferRequestId: prep.transferRequestId,
        proposalSnapshot: snapshot,
        recipientDisplayName,
        card,
      },
    ];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not prepare transfer.";
    return [{ type: "error", message: msg, code: "prepare_transfer_failed" }];
  }
}

/**
 * Read-only: active Sui account address for assistant cards (never returns secrets).
 */
export async function getWalletAddressAction(
  _input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Switch to a Sui account to show an address.", code: "unsupported_chain" }];
  }
  const net = ctx.network.getActiveNetwork();
  return [
    {
      type: "wallet_address",
      network: net.displayName,
      accountLabel: account.name,
      address: account.address,
    },
  ];
}
