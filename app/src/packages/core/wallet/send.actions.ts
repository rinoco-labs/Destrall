import { randomUUID } from "node:crypto";
import type { AssistantProposalCard, AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import type { SendProposalSnapshot } from "../../runtime/transactionProposalTypes";
import { parseOtherAccountRecipient } from "../../../services/contacts/contactResolutionService";
import { resolveSendRecipient } from "../../../services/contacts/recipientResolutionService";

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
  summary: {
    symbol: string;
    amountFormatted: string;
    recipient: string;
    gasBudgetFormatted: string;
  };
  network: string;
  fromAccountLabel: string;
  recipientDisplayName?: string;
  coinType: string;
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
      { k: "Token", v: params.summary.symbol },
      { k: "Coin type", v: params.coinType },
      { k: "Amount (formatted)", v: `${params.summary.amountFormatted} ${params.summary.symbol}` },
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

  const account = ctx.wallet.getActiveAccount();
  if (!account || account.chain !== "sui") {
    return [{ type: "error", message: "Only Sui accounts support sends from the assistant.", code: "unsupported_chain" }];
  }

  const balances = await ctx.wallet.getBalances();
  const coinType = ctx.tokens.resolveTokenSymbol(token, balances);
  if (!coinType) {
    return [
      {
        type: "error",
        message: `Could not resolve "${token}" to a coin in this wallet. Check the symbol and try again.`,
        code: "unknown_token",
      },
    ];
  }

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

  try {
    const prep = await ctx.wallet.prepareSendTransaction({
      recipient: recipientAddress,
      coinType,
      amountDisplay: amount,
    });
    const { summary } = prep;

    const snapshot: SendProposalSnapshot = {
      accountId: ctx.accountId,
      suiEnvironment: net.environment,
      senderAddress: account.address,
      recipientAddress: summary.recipient,
      coinType: summary.coinType,
      amountDisplay: amount,
    };

    const card = buildSendCard({
      summary: {
        symbol: summary.symbol,
        amountFormatted: summary.amountFormatted,
        recipient: summary.recipient,
        gasBudgetFormatted: summary.gasBudgetFormatted,
      },
      network: net.displayName,
      fromAccountLabel: `${account.name} (${account.address.slice(0, 8)}…)`,
      recipientDisplayName,
      coinType: summary.coinType,
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
