import { buildVoiceApiUrl } from "@/lib/api"

export type VoiceTokenRequest = {
  canvasId: string
  userId: string
  displayName?: string
  apiBaseUrl?: string
}

export type VoiceAgentMetadata = {
  enabled: boolean
  name: string
  wake_phrases: string[]
  transcription_mode: "livekit_inference" | "mock"
  transcript_forwarding_enabled: boolean
  transcript_partials_enabled: boolean
  diarization_enabled: boolean
}

export type VoiceTokenResponse = {
  server_url: string
  room_name: string
  participant_identity: string
  participant_name: string | null
  agent: VoiceAgentMetadata | null
  token: string
}

function getErrorDetail(payload: unknown) {
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

export function buildVoiceTokenUrl(configuredBaseUrl?: string) {
  return buildVoiceApiUrl("/api/voice/token", configuredBaseUrl)
}

export async function requestVoiceToken({
  canvasId,
  userId,
  displayName,
  apiBaseUrl,
}: VoiceTokenRequest): Promise<VoiceTokenResponse> {
  const response = await fetch(buildVoiceTokenUrl(apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      canvas_id: canvasId,
      user_id: userId,
      display_name: displayName,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | VoiceTokenResponse
    | { detail?: string }
    | null

  if (!response.ok) {
    throw new Error(getErrorDetail(payload) ?? "Voice token request failed.")
  }

  return payload as VoiceTokenResponse
}
