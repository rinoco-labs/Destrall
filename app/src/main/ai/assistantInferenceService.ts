import type { ChatHistoryItem, ChatModelResponse, LlamaModel } from "node-llama-cpp";
import { buildDestrallAssistantSystemPrompt } from "../../assistant/systemPrompt";

export type ChatTurnMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class AssistantInferenceService {
  async generateReply(params: {
    model: LlamaModel;
    messages: ChatTurnMessage[];
    language: string;
    personalityId: string;
    walletContext: string;
  }): Promise<string> {
    const { model, messages, language, personalityId, walletContext } = params;
    if (messages.length === 0) {
      throw new Error("No messages provided");
    }
    const last = messages[messages.length - 1];
    if (last.role !== "user") {
      throw new Error("Last message must be from the user");
    }

    const context = await model.createContext();
    try {
      const { LlamaChatSession } = await import("node-llama-cpp");
      const sequence = context.getSequence();
      const systemPrompt = buildDestrallAssistantSystemPrompt({
        language,
        personalityId,
        walletContext,
      });

      const session = new LlamaChatSession({
        contextSequence: sequence,
        systemPrompt,
      });

      const prior = messages.slice(0, -1);
      const history: ChatHistoryItem[] = [];
      for (const m of prior) {
        if (m.role === "system") {
          history.push({ type: "system", text: m.content });
        } else if (m.role === "user") {
          history.push({ type: "user", text: m.content });
        } else {
          const modelResponse: ChatModelResponse = { type: "model", response: [m.content] };
          history.push(modelResponse);
        }
      }
      if (history.length > 0) {
        session.setChatHistory(history);
      }

      const responseText = await session.prompt(last.content, {
        maxTokens: 1024,
        temperature: 0.65,
      });
      session.dispose({ disposeSequence: true });
      return responseText;
    } finally {
      context.dispose();
    }
  }
}

export const assistantInferenceService = new AssistantInferenceService();
