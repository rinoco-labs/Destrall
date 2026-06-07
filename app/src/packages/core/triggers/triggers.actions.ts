import type { AssistantStructuredResult, TriggerListResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import {
  createTriggerInputSchema,
  executeDueTriggerInputSchema,
  listTriggersInputSchema,
  triggerIdInputSchema,
  triggerNameHintInputSchema,
} from "./triggers.schemas";
import { parseTriggerFromText, resolveAtPriceOperator } from "./triggerParser";
import { buildTriggerProposal } from "./triggerProposalBuilder";
import { triggerStorageService } from "./triggerStorageService";
import { executeDueTriggerById } from "./triggerExecutor";
import type { TriggerDraft, TriggerPriceCondition, TriggerRecord } from "./triggers.types";
import { defaultNextCheckAtIso } from "../../../services/time/time.service";
import { mapTriggerRecordToListItem } from "../../../services/triggers/triggerListMapper";
import { priceService } from "../../../services/prices/priceService";
import { logTriggerIntentRouting } from "../../../assistant/triggerIntentVocabulary";

function findTriggerByNameHint(accountId: string, hint: string): TriggerRecord | null {
  const needle = hint.toLowerCase();
  const rows = triggerStorageService.list(accountId);
  return (
    rows.find((r) => r.name.toLowerCase().includes(needle)) ??
    rows.find((r) => r.description.toLowerCase().includes(needle)) ??
    null
  );
}

async function finalizeTriggerDraft(draft: TriggerDraft, ctx: ActionContext): Promise<TriggerDraft | { error: string }> {
  if (draft.type !== "price") return draft;

  const cond = draft.condition as TriggerPriceCondition;
  if (!cond.needsAtResolution && cond.operator !== "target") return draft;

  const quote = await priceService.getTokenPriceBySymbol(cond.asset);
  const resolved = resolveAtPriceOperator({
    asset: cond.asset,
    priceUsd: cond.priceUsd ?? "",
    action: draft.action,
    currentPriceUsd: quote?.priceUsd ?? null,
  });

  if (resolved.error) {
    return { error: resolved.error };
  }

  const nextCond: TriggerPriceCondition = {
    ...cond,
    operator: resolved.operator,
    needsAtResolution: undefined,
  };
  return {
    ...draft,
    condition: nextCond,
    description: `${cond.asset} ${resolved.operator} $${cond.priceUsd}`,
  };
}

export async function createTriggerAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = createTriggerInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid trigger request.", code: "invalid_input" }];
  }

  let draft: TriggerDraft | null = null;
  if (parsed.data.draftJson) {
    try {
      draft = JSON.parse(parsed.data.draftJson) as TriggerDraft;
    } catch {
      return [{ type: "error", message: "Invalid trigger draft.", code: "invalid_draft" }];
    }
  } else if (parsed.data.naturalLanguage) {
    const result = parseTriggerFromText(parsed.data.naturalLanguage);
    logTriggerIntentRouting({
      rawText: parsed.data.naturalLanguage,
      intent: "trigger",
      triggerType: result.ok ? result.draft.type : undefined,
      missingFields: result.ok ? undefined : result.missing,
      proposalCreated: false,
    });
    if (result.ok === false) {
      const ask = result.missing.join("; ");
      return [
        {
          type: "error",
          message: `I need a bit more detail: ${ask}`,
          code: "trigger_incomplete",
        },
      ];
    }
    const finalized = await finalizeTriggerDraft(result.draft, ctx);
    if ("error" in finalized) {
      return [{ type: "error", message: finalized.error, code: "trigger_incomplete" }];
    }
    draft = finalized;
  } else {
    return [{ type: "error", message: "Describe the trigger you want to create.", code: "invalid_input" }];
  }

  const net = ctx.network.getActiveNetwork();
  const built = await buildTriggerProposal({ draft, ctx, networkLabel: net.displayName });
  if ("error" in built) {
    return [{ type: "error", message: built.error, code: "trigger_build_failed" }];
  }

  logTriggerIntentRouting({
    rawText: parsed.data.naturalLanguage ?? "",
    intent: "trigger",
    triggerType: draft.type,
    proposalCreated: true,
  });

  return [built];
}

export async function listTriggersAction(
  _input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = listTriggersInputSchema.safeParse(_input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid request.", code: "invalid_input" }];
  }
  const rows = triggerStorageService.list(ctx.accountId);
  const block: TriggerListResult = {
    type: "trigger_list",
    triggers: rows.map(mapTriggerRecordToListItem),
  };
  return [block];
}

export async function pauseTriggerAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const byId = triggerIdInputSchema.safeParse(input);
  const byName = triggerNameHintInputSchema.safeParse(input);
  let id: string | null = byId.success ? byId.data.triggerId : null;
  if (!id && byName.success) {
    const row = findTriggerByNameHint(ctx.accountId, byName.data.nameHint);
    id = row?.id ?? null;
  }
  if (!id) {
    return [{ type: "error", message: "Which trigger should I pause?", code: "trigger_not_found" }];
  }
  const updated = triggerStorageService.setStatus(id, ctx.accountId, "paused");
  if (!updated) {
    return [{ type: "error", message: "Trigger not found.", code: "trigger_not_found" }];
  }
  return listTriggersAction({}, ctx);
}

export async function resumeTriggerAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const byId = triggerIdInputSchema.safeParse(input);
  const byName = triggerNameHintInputSchema.safeParse(input);
  let id: string | null = byId.success ? byId.data.triggerId : null;
  if (!id && byName.success) {
    const row = findTriggerByNameHint(ctx.accountId, byName.data.nameHint);
    id = row?.id ?? null;
  }
  if (!id) {
    return [{ type: "error", message: "Which trigger should I resume?", code: "trigger_not_found" }];
  }
  const updated = triggerStorageService.setStatus(id, ctx.accountId, "active");
  if (!updated) {
    return [{ type: "error", message: "Trigger not found.", code: "trigger_not_found" }];
  }
  const { runTriggerSchedulerNow } = await import("./triggerScheduler");
  runTriggerSchedulerNow(ctx.accountId);
  return listTriggersAction({}, ctx);
}

export async function deleteTriggerAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const byId = triggerIdInputSchema.safeParse(input);
  const byName = triggerNameHintInputSchema.safeParse(input);
  let id: string | null = byId.success ? byId.data.triggerId : null;
  if (!id && byName.success) {
    const row = findTriggerByNameHint(ctx.accountId, byName.data.nameHint);
    id = row?.id ?? null;
  }
  if (!id) {
    return [{ type: "error", message: "Which trigger should I delete?", code: "trigger_not_found" }];
  }
  const updated = triggerStorageService.setStatus(id, ctx.accountId, "deleted");
  if (!updated) {
    return [{ type: "error", message: "Trigger not found.", code: "trigger_not_found" }];
  }
  return listTriggersAction({}, ctx);
}

export async function executeDueTriggerAction(
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  const parsed = executeDueTriggerInputSchema.safeParse(input);
  if (!parsed.success) {
    return [{ type: "error", message: "Invalid request.", code: "invalid_input" }];
  }
  const row = triggerStorageService.get(parsed.data.triggerId, ctx.accountId);
  if (!row) {
    return [{ type: "error", message: "Trigger not found.", code: "trigger_not_found" }];
  }
  const outcome = await executeDueTriggerById(row.id);
  if (outcome.status === "success") {
    return [
      {
        type: "transaction_result",
        title: "Trigger executed",
        digest: outcome.txDigest ?? "",
        summary: "Automated trigger completed within approved limits.",
      },
    ];
  }
  return [
    {
      type: "error",
      message: outcome.error ?? "Trigger did not execute.",
      code: "trigger_skipped",
    },
  ];
}

/** Called from IPC after user approves a trigger proposal card. */
export function persistApprovedTrigger(params: {
  accountId: string;
  chain: string;
  network: string;
  draft: TriggerDraft;
  approval: import("./triggers.types").TriggerApprovalLimits;
}): TriggerRecord {
  const schedule = params.draft.schedule ?? null;
  const nextCheck = defaultNextCheckAtIso(params.draft.type, schedule);
  const maxExec =
    params.draft.maxExecutions ?? (params.draft.type === "price" ? 1 : params.approval.maxExecutions);
  return triggerStorageService.saveApproved({
    accountId: params.accountId,
    chain: params.chain,
    network: params.network,
    draft: params.draft,
    approval: {
      ...params.approval,
      approvedAt: new Date().toISOString(),
    },
    schedule,
    maxExecutions: maxExec,
    nextCheckAt: nextCheck,
  });
}
