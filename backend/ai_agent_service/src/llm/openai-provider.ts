import OpenAI from "openai";
import type { LLMProvider, Message, Tool, LLMResponse, ToolCall } from "./types.js";

export function createOpenAIProvider(apiKey: string, model: string, baseURL?: string): LLMProvider {
  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });

  return {
    async chat(messages: Message[], tools: Tool[]): Promise<LLMResponse> {
      const openaiTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
        },
      }));

      const response = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      const choice = response.choices[0];
      const text = choice.message.content;
      const toolCalls: ToolCall[] = (choice.message.tool_calls ?? [])
        .filter((tc): tc is OpenAI.ChatCompletionMessageToolCall & { type: "function" } => tc.type === "function")
        .map((tc) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));

      return { text, toolCalls };
    },
  };
}
