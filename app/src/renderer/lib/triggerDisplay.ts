import type {
  TriggerAction,
  TriggerCategory,
  TriggerPriceCondition,
  TriggerRecord,
} from "../../packages/core/triggers/triggers.types";

function categoryLabel(type: TriggerCategory): string {
  switch (type) {
    case "price":
      return "Price";
    case "time":
      return "Time";
    case "yield":
      return "Yield";
    case "portfolio":
      return "Portfolio";
    default:
      return type;
  }
}

export type TriggerListDisplay = {
  conditionSummary: string;
  actionSummary: string;
  actionTypeLabel: string;
  assetLabel: string | null;
};

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function summarizeTriggerForList(record: TriggerRecord): TriggerListDisplay {
  const cond = parseJson<TriggerPriceCondition | Record<string, unknown>>(record.conditionJson);
  const action = parseJson<TriggerAction>(record.actionJson);

  let conditionSummary = record.description;
  if (record.type === "price" && cond && "asset" in cond && cond.asset && "operator" in cond && cond.operator) {
    const price = "priceUsd" in cond && cond.priceUsd ? ` $${cond.priceUsd}` : "";
    conditionSummary = `${cond.asset} ${cond.operator}${price}`;
  }

  let actionSummary = record.description;
  let actionTypeLabel = categoryLabel(record.type);
  let assetLabel: string | null = null;

  if (action?.type === "swap") {
    actionTypeLabel = "Swap";
    actionSummary = `Swap ${action.amount} ${action.fromToken} → ${action.toToken}`;
    assetLabel = action.fromToken;
  } else if (action?.type === "yield_collect") {
    actionTypeLabel = "Yield withdraw";
    actionSummary = action.asset ? `Collect yield (${action.asset})` : "Collect Navi yield";
    assetLabel = action.asset ?? null;
  }

  return { conditionSummary, actionSummary, actionTypeLabel, assetLabel };
}

export function formatTriggerDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
