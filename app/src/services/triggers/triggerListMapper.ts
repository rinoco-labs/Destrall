import type { TriggerListResult } from "../../assistant/assistantResultTypes";
import type { TriggerCategory, TriggerRecord } from "../../packages/core/triggers/triggers.types";
import { formatTriggerNextCheckLabel } from "../time/trigger-schedule-display";

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

export function mapTriggerRecordToListItem(
  record: TriggerRecord,
): TriggerListResult["triggers"][number] {
  const cond = JSON.parse(record.conditionJson) as Record<string, unknown>;
  const action = JSON.parse(record.actionJson) as Record<string, unknown>;
  let conditionText = record.description;
  if (record.type === "price" && cond.asset && cond.operator && cond.priceUsd) {
    conditionText = `${cond.asset} ${cond.operator} $${cond.priceUsd}`;
  }
  let actionText = record.description;
  if (action.type === "swap") {
    actionText = `Swap ${action.amount} ${action.fromToken} → ${action.toToken}`;
  } else if (action.type === "yield_collect") {
    actionText = "Collect Navi yield";
  }

  return {
    id: record.id,
    name: record.name,
    type: record.type,
    typeLabel: categoryLabel(record.type),
    status: record.status,
    conditionSummary: conditionText,
    actionSummary: actionText,
    nextCheckAt: record.nextCheckAt,
    nextCheckLabel: formatTriggerNextCheckLabel(record),
    lastTriggeredAt: record.lastTriggeredAt,
    executionCount: record.executionCount,
    maxExecutions: record.maxExecutions,
  };
}

export function mapTriggerRecordsToListResult(records: TriggerRecord[]): TriggerListResult["triggers"] {
  return records.map(mapTriggerRecordToListItem);
}
