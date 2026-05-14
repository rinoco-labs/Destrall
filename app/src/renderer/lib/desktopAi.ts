import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantRuntimeState,
  LlmStateSnapshot,
  ModelProgressEvent,
  RpcResult,
} from "../../shared/ipc";

function api() {
  if (typeof window === "undefined" || !window.destrallApi) {
    throw new Error("Destrall API is not available in this context.");
  }
  return window.destrallApi;
}

async function unwrap<T>(result: Promise<RpcResult<T>>): Promise<T> {
  const response = await result;
  if (response.ok === false) {
    throw new Error(response.error);
  }
  return response.data;
}

export async function desktopLlmGetState(): Promise<LlmStateSnapshot> {
  return unwrap(api().llm.getState());
}

export async function desktopLlmInstallModel(): Promise<LlmStateSnapshot> {
  return unwrap(api().llm.installModel());
}

export async function desktopLlmLoadModel(): Promise<LlmStateSnapshot> {
  return unwrap(api().llm.loadModel());
}

export async function desktopLlmUnloadModel(): Promise<LlmStateSnapshot> {
  return unwrap(api().llm.unloadModel());
}

export async function desktopLlmDeleteModel(): Promise<LlmStateSnapshot> {
  return unwrap(api().llm.deleteModel());
}

export async function desktopLlmCancelDownload(): Promise<void> {
  await unwrap(api().llm.cancelDownload());
}

export async function desktopLlmAssistantRuntime(): Promise<AssistantRuntimeState> {
  return unwrap(api().llm.assistantRuntime());
}

export async function desktopLlmChat(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
  return unwrap(api().llm.chat(payload));
}

export function desktopLlmOnModelProgress(listener: (event: ModelProgressEvent) => void): () => void {
  return api().llm.onModelProgress(listener);
}
