import { buildApiUrl } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"

export type ImageGenerationRequest = {
  nodeId: string
  text: string
  resolution: string
}

export type ImageGenerationResponse = {
  status: string
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
