import { describe, it, expect, vi } from "vitest";
import { createProviderRouter } from "../provider-router.js";
import type { LLMProvider, Message, Tool } from "../types.js";

function createMockProvider(response: { text: string }): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue({ text: response.text, toolCalls: [] }),
  };
}

describe("ProviderRouter", () => {
  it("routes to the configured provider", async () => {
    const claude = createMockProvider({ text: "claude response" });
    const openai = createMockProvider({ text: "openai response" });

    const router = createProviderRouter({ claude, openai }, "claude");
    const result = await router.chat(
      [{ role: "user", content: "hello" }],
      []
    );

    expect(result.text).toBe("claude response");
    expect(claude.chat).toHaveBeenCalledOnce();
    expect(openai.chat).not.toHaveBeenCalled();
  });

  it("routes to openai when configured", async () => {
    const claude = createMockProvider({ text: "claude response" });
    const openai = createMockProvider({ text: "openai response" });

    const router = createProviderRouter({ claude, openai }, "openai");
    const result = await router.chat(
      [{ role: "user", content: "hello" }],
      []
    );

    expect(result.text).toBe("openai response");
    expect(openai.chat).toHaveBeenCalledOnce();
  });
});
