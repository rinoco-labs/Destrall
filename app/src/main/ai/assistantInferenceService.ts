import type { ChatHistoryItem, ChatModelResponse, LlamaModel } from "node-llama-cpp";

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
      const systemPrompt = [
        `You are Destrall assistant. Respond in ${language}.`,
        `Personality preset: ${personalityId}.`,
        "When the Context mentions that a structured card is shown (swaps, sends, Navi yield pools, Navi positions, or Navi proposals), answer in plain language only: do not paste code, do not tell the user to install the Sui or Navi SDK, and do not invent contract addresses or APYs.",
        "Never mention internal action ids (for example names starting with core.) or tell the user to run a tool; the app runs tools automatically when a card appears.",
        walletContext ? `Context:\n${walletContext}` : "",
      ]
        .filter(Boolean)
        .join("\n");

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
