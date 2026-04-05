import "dotenv/config";

export const config = {
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  liveblocks: {
    secretKey: requireEnv("LIVEBLOCKS_SECRET_KEY"),
  },
  internal: {
    token: process.env.AI_AGENT_INTERNAL_TOKEN ?? "dev-ai-agent-token",
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
      baseURL: process.env.OPENAI_BASE_URL,
    },
  },
  server: {
    port: parseInt(process.env.PORT ?? "3001", 10),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },
  agent: {
    proactiveIntervalMs: parseInt(process.env.AI_PROACTIVE_INTERVAL_MS ?? "10000", 10),
  },
} as const;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}
