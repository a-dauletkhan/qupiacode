import type { LLMProvider, Message, Tool, LLMResponse } from "./types.js";

interface Providers {
  claude: LLMProvider;
  openai: LLMProvider;
}

export function createProviderRouter(
  providers: Providers,
  activeProvider: "claude" | "openai"
): LLMProvider {
  return {
    chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      return providers[activeProvider].chat(messages, tools);
    },
  };
}
