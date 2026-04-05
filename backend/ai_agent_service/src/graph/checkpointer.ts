import { MemorySaver } from "@langchain/langgraph";

export async function createCheckpointer() {
  // Redis Stack (with JSON + Search modules) is required for RedisSaver.
  // Use MemorySaver for local dev. Switch to RedisSaver in production
  // when Redis Stack is available.
  console.log("Checkpointer: using MemorySaver (in-memory)");
  return new MemorySaver();
}
