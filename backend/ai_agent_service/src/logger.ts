import pino from "pino";

const level = (process.env.AI_AGENT_LOG_LEVEL ?? "info").toLowerCase();

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});

export function roomLogger(roomId: string) {
  return logger.child({ roomId });
}
