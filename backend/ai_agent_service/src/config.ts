import "dotenv/config";

export const config = {
  liveblocks: {
    secretKey: requireEnv("LIVEBLOCKS_SECRET_KEY"),
  },
  llm: {
    provider: (process.env.LLM_PROVIDER ?? "claude") as "claude" | "openai",
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    },
  },
  server: {
    port: parseInt(process.env.PORT ?? "3001", 10),
  },
} as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
