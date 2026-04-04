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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: "GET",
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export function sendCommand(roomId: string, req: AiCommandRequest): Promise<AiCommandResponse> {
  return post(`/api/ai/rooms/${roomId}/command`, req)
}

export function sendEvents(roomId: string, req: AiEventsRequest): Promise<AiEventsResponse> {
  return post(`/api/ai/rooms/${roomId}/events`, req)
}

export function sendFeedback(roomId: string, req: AiFeedbackRequest): Promise<AiFeedbackResponse> {
  return post(`/api/ai/rooms/${roomId}/feedback`, req)
}

export function getQueue(roomId: string): Promise<AiQueueResponse> {
  return get(`/api/ai/rooms/${roomId}/queue`)
}
