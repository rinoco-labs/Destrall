const HAS_SCHEDULE_RE =
  /\b(?:in\s+\d+\s*(?:minutes?|hours?|days?)|tomorrow|tonight|every\s+(?:day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s*hours?)|daily|weekly|monthly|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|@)\b/i;

const PRICE_CONDITION_RE =
  /\b(?:when|if)\s+\w+\s+(?:is\s+at|drops?\s+to|falls?\s+(?:to|below)|goes?\s+(?:above|below|up|down)|rises?\s+to|hits?|reaches?|is\s+below|is\s+above)\b/i;

const PRICE_ACTION_TAIL_RE =
  /\b(?:sell|buy|swap|deposit|withdraw|send)\s+[\d.,]+\s*\w+/i;

const ACTION_AT_TIME_RE =
  /\b(?:sell|swap|trade|convert|deposit|withdraw|send)\s+[\d.,]+\s*\w+\s+(?:at|@)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i;

const RECURRING_ACTION_RE =
  /\b(?:every\s+(?:day|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|daily|weekly|monthly)\b/i;

const CREATE_TRIGGER_RE = /\b(?:create|set\s+up|make)\s+(?:a\s+)?trigger\b/i;

const TRIGGER_HELP_RE =
  /\b(?:how\s+(?:do|to|can)|what\s+are|explain|tell\s+me\s+about)\b.*\btriggers?\b/i;

const TRIGGERS_TODAY_RE =
  /\b(?:what\s+)?triggers?\s+(?:are\s+)?(?:scheduled|due)\s+today\b/i;

function hasScheduleIntent(text: string): boolean {
  return HAS_SCHEDULE_RE.test(text.trim());
}

function isTriggerManagementCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(?:show|list)\s+(?:my\s+)?triggers\b/.test(lower) ||
    /\b(?:pause|resume|start|delete|remove)\s+(?:my\s+)?(?:trigger\b|the\s+.+?\s+trigger)/.test(lower)
  );
}

/**
 * True when the user is giving a trigger creation instruction (not management or help).
 */
export function hasTriggerCreateIntent(text: string): boolean {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (!t) return false;
  if (isTriggerManagementCommand(t)) return false;
  if (TRIGGER_HELP_RE.test(lower)) return false;
  if (TRIGGERS_TODAY_RE.test(lower)) return false;

  if (CREATE_TRIGGER_RE.test(lower)) return true;
  if (hasScheduleIntent(t) && /\b(?:sell|buy|swap|deposit|withdraw|send|collect|harvest|rebalance)\b/i.test(lower)) {
    return true;
  }
  if (ACTION_AT_TIME_RE.test(lower)) return true;
  if (RECURRING_ACTION_RE.test(lower) && /\b(?:sell|buy|swap|deposit|withdraw|send|collect|harvest)\b/i.test(lower)) {
    return true;
  }
  if (PRICE_CONDITION_RE.test(lower)) return true;
  if (/\b(?:sell|buy)\s+\w+\s+when\b/i.test(lower)) return true;
  if (/\b(?:when|if)\b/i.test(lower) && PRICE_ACTION_TAIL_RE.test(lower)) return true;
  if (
    /\b(?:when|if|at|every)\b/i.test(lower) &&
    /\b(?:above|below|reaches?|drops?\s+to|falls?\s+below|goes?\s+above|goes?\s+below|hits?)\b/i.test(lower) &&
    /\b(?:sell|buy|swap|deposit|withdraw)\b/i.test(lower)
  ) {
    return true;
  }

  return false;
}

export type TriggerIntentLog = {
  rawText: string;
  intent: "trigger";
  triggerType?: string;
  parsedCondition?: string;
  parsedAction?: string;
  missingFields?: string[];
  proposalCreated?: boolean;
};

export function logTriggerIntentRouting(entry: TriggerIntentLog): void {
  const safe = {
    intent: entry.intent,
    triggerType: entry.triggerType,
    parsedCondition: entry.parsedCondition,
    parsedAction: entry.parsedAction,
    missingFields: entry.missingFields,
    proposalCreated: entry.proposalCreated,
    textLen: entry.rawText.length,
  };
  console.info("[assistant] trigger intent", JSON.stringify(safe));
}
