import { PREPARE_SEND_ACTION_NAME } from "./assistantFunctionSchemas";

export type RoutedAssistantToolCall = {
  namespacedName: string;
  input: Record<string, unknown>;
};

function normalizeUserText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Deterministic planner: maps natural send phrasing → prepare_send tool args.
 * When no pattern matches, returns null (caller may still run the LLM with tool schemas only).
 */
export function tryRouteAssistantToolCall(userText: string): RoutedAssistantToolCall | null {
  const text = normalizeUserText(userText);

  const sendTo = text.match(/\b(?:send|transfer)\s+([\d.,]+)\s+(\w+)\s+to\s+(.+)/i);
  if (sendTo) {
    const [, amt, sym, destRaw] = sendTo;
    const dest = destRaw.trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient: dest },
    };
  }

  const payAmountTo = text.match(/\bpay\s+([\d.,]+)\s+(\w+)\s+to\s+(.+)/i);
  if (payAmountTo) {
    const [, amt, sym, destRaw] = payAmountTo;
    const dest = destRaw.trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient: dest },
    };
  }

  const payNameAmount = text.match(/\bpay\s+(.+?)\s+([\d.,]+)\s+(\w+)\b(?:\s+to\s+(.+))?/i);
  if (payNameAmount) {
    const [, name, amt, sym, maybeTo] = payNameAmount;
    const recipient = (maybeTo ?? name).trim().replace(/[.,!?;:]+$/, "");
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient },
    };
  }

  const otherWallet = text.match(
    /\b(?:send|transfer|pay)\s+([\d.,]+)\s+(\w+)\s+to\s+my\s+other\s+(?:wallet|account)(?:\s+(.+))?$/i,
  );
  if (otherWallet) {
    const [, amt, sym, hint] = otherWallet;
    const h = (hint ?? "").trim();
    const recipient = h ? `__OTHER_ACCOUNT__:${h}` : "__OTHER_ACCOUNT__:";
    return {
      namespacedName: PREPARE_SEND_ACTION_NAME,
      input: { token: sym, amount: amt, recipient },
    };
  }

  return null;
}
