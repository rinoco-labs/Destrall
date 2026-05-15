import type { AssistantStructuredResult } from "../../../assistant/assistantResultTypes";
import type { ActionContext } from "../../runtime/actionContext";
import { getCurrentTimePayload } from "../../../services/time/time.service";

export async function getCurrentTimeAction(
  _input: Record<string, unknown>,
  _ctx: ActionContext,
): Promise<AssistantStructuredResult[]> {
  void _input;
  void _ctx;
  const payload = getCurrentTimePayload();
  return [
    {
      type: "time_info",
      localTime: payload.localTime,
      timezone: payload.timezone,
      utcTime: payload.utcTime,
      formatted: payload.formatted,
      weekday: payload.weekday,
      utcOffset: payload.utcOffset,
    },
  ];
}
