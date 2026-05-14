import { ipcMain } from "electron";
import { z } from "zod";
import type { AssistantChatRequest, RpcResult } from "../../shared/ipc";
import { IPCChannels } from "../../shared/ipc";
import { aiModelMainService } from "../ai/aiModelMainService";

function ok<T>(data: T): RpcResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): RpcResult<never> {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return { ok: false, error: message };
}

const assistantChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  accountId: z.string().min(1),
  language: z.string(),
  personalityId: z.string(),
});

export function registerAiModelIpcHandlers() {
  ipcMain.handle(IPCChannels.llmGetState, async () => {
    try {
      return ok(aiModelMainService.getState());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmInstallModel, async (event) => {
    try {
      return ok(await aiModelMainService.installModel(event.sender));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmLoadModel, async (event) => {
    try {
      return ok(await aiModelMainService.loadModel(event.sender));
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmUnloadModel, async () => {
    try {
      return ok(await aiModelMainService.unloadModel());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmDeleteModel, async () => {
    try {
      return ok(await aiModelMainService.deleteModel());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmCancelDownload, async () => {
    try {
      aiModelMainService.cancelDownload();
      return ok({ ok: true as const });
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmAssistantRuntime, async () => {
    try {
      return ok(aiModelMainService.getAssistantRuntimeState());
    } catch (error) {
      return fail(error);
    }
  });

  ipcMain.handle(IPCChannels.llmChat, async (_event, payload: unknown) => {
    const parsed = assistantChatSchema.safeParse(payload);
    if (!parsed.success) {
      return fail(new Error(parsed.error.issues[0]?.message ?? "Invalid chat request"));
    }
    try {
      return ok(await aiModelMainService.chat(parsed.data as AssistantChatRequest));
    } catch (error) {
      return fail(error);
    }
  });
}
