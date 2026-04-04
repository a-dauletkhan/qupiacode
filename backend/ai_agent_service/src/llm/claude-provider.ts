import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, Message, Tool, LLMResponse, ToolCall } from "./types.js";

export function createClaudeProvider(apiKey: string, model: string): LLMProvider {
  const client = new Anthropic({ apiKey });

  return {
    async chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      const systemMessage = messages.find((m) => m.role === "system");
      const nonSystemMessages = messages.filter((m) => m.role !== "system");

      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as unknown as Anthropic.Tool.InputSchema,
      }));

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemMessage?.content ?? "",
        messages: nonSystemMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      });

      let text: string | null = null;
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === "text") {
          text = block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          });
        }
      }

      return { text, toolCalls };
    },
  };
}
