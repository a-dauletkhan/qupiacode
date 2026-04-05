import { buildApiUrl } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"

export type ImageGenerationRequest = {
  nodeId: string
  text: string
  resolution: string
}

export type ImageGenerationResponse = {
  status: string
  request_id: string
}

export type ImageGenerationStatus = {
  request_id: string
  status: string
  status_url: string | null
  cancel_url: string | null
  images: Array<{
    url: string
  }>
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken()

  if (!token) {
    throw new Error("Missing access token")
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail
  }

  return null
}

export async function requestImageGeneration({
  nodeId,
  text,
  resolution,
}: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const response = await fetch(buildApiUrl("/images/generate"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      node_id: nodeId,
      text,
      resolution,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | ImageGenerationResponse
    | { detail?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload) ?? "Image generation request failed.")
  }

  return payload as ImageGenerationResponse
}

export async function requestImageGenerationStatus(
  requestId: string
): Promise<ImageGenerationStatus> {
  const response = await fetch(buildApiUrl(`/images/status/${requestId}`), {
    method: "GET",
    headers: authHeaders(),
  })

  const payload = (await response.json().catch(() => null)) as
    | ImageGenerationStatus
    | { detail?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorMessage(payload) ?? "Image generation status request failed.")
  }

  return payload as ImageGenerationStatus
}
