import { buildApiUrl } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import type {
  AiCommandRequest,
  AiCommandResponse,
  AiEventsRequest,
  AiEventsResponse,
  AiFeedbackRequest,
  AiFeedbackResponse,
  AiQueueResponse,
} from "../types"

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function post<T>(path: string, body: unknown, action: string): Promise<T> {
  const url = buildApiUrl(path)
  console.info(`[ai-agent] → POST ${url}`, `\n  action: ${action}`, "\n  payload:", body)
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({ message: res.statusText }))
  if (!res.ok) {
    console.info(`[ai-agent] ✗ POST ${url} → ${res.status}`, data)
    throw new Error(data.message ?? `Request failed: ${res.status}`)
  }
  console.info(`[ai-agent] ✓ POST ${url} → ${res.status}`, data)
  return data as T
}

async function get<T>(path: string, action: string): Promise<T> {
  const url = buildApiUrl(path)
  console.info(`[ai-agent] → GET ${url}`, `\n  action: ${action}`)
  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({ message: res.statusText }))
  if (!res.ok) {
    console.info(`[ai-agent] ✗ GET ${url} → ${res.status}`, data)
    throw new Error(data.message ?? `Request failed: ${res.status}`)
  }
  console.info(`[ai-agent] ✓ GET ${url} → ${res.status}`, data)
  return data as T
}

export function sendCommand(roomId: string, req: AiCommandRequest): Promise<AiCommandResponse> {
  return post(`/api/ai/rooms/${roomId}/command`, req, `command: "${req.message}" from ${req.userName} (source: ${req.context.source})`)
}

export function sendEvents(roomId: string, req: AiEventsRequest): Promise<AiEventsResponse> {
  return post(`/api/ai/rooms/${roomId}/events`, req, `events batch: ${req.events.length} events [${req.events.map((e) => e.type).join(", ")}]`)
}

export function sendFeedback(roomId: string, req: AiFeedbackRequest): Promise<AiFeedbackResponse> {
  return post(`/api/ai/rooms/${roomId}/feedback`, req, `feedback: ${req.status} on action ${req.actionId} (nodes: ${req.nodeIds.join(", ")})`)
}

export function getQueue(roomId: string): Promise<AiQueueResponse> {
  return get(`/api/ai/rooms/${roomId}/queue`, "poll queue status")
}
