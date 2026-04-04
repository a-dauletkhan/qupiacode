import * as React from "react"

import {
  type UseVoiceCallOptions,
  type UseVoiceCallResult,
  useVoiceCall,
} from "@/modules/VoiceCall/hooks/use-voice-call"

const VoiceCallContext = React.createContext<UseVoiceCallResult | null>(null)

type VoiceCallProviderProps = React.PropsWithChildren<UseVoiceCallOptions>

export function VoiceCallProvider({
  children,
  canvasId,
  userId,
  displayName,
  apiBaseUrl,
}: VoiceCallProviderProps) {
  const value = useVoiceCall({
    canvasId,
    userId,
    displayName,
    apiBaseUrl,
  })

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
    </VoiceCallContext.Provider>
  )
}

export function useVoiceCallContext() {
  const context = React.useContext(VoiceCallContext)
  if (context === null) {
    throw new Error(
      "useVoiceCallContext must be used inside VoiceCallProvider."
    )
  }
  return context
}
