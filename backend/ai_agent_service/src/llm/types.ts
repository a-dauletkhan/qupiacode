export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolParameter {
  type: string;
  description: string;
  properties?: Record<string, ToolParameter>;
  required?: string[];
  items?: ToolParameter;
  enum?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  text: string | null;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  chat(messages: Message[], tools: Tool[]): Promise<LLMResponse>;
}
