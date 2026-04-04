/**
 * Simple external store for AI agent chat messages.
 *
 * The mock bridge pushes messages here, and Chat.tsx subscribes
 * to render them alongside the voice transcript and team chat.
 */

import { useSyncExternalStore } from "react"
import type { VoiceCallChatMessageView } from "@/modules/VoiceCall/hooks/use-voice-call"

type Listener = () => void

let messages: VoiceCallChatMessageView[] = []
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export const aiChatStore = {
  addMessage(msg: VoiceCallChatMessageView) {
    messages = [...messages, msg]
    notify()
  },

  removeByActionId(actionId: string) {
    messages = messages.filter((m) => !m.id.includes(actionId))
    notify()
  },

  getMessages() {
    return messages
  },

  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useAiChatMessages(): VoiceCallChatMessageView[] {
  return useSyncExternalStore(
    aiChatStore.subscribe,
    aiChatStore.getMessages,
    aiChatStore.getMessages,
  )
}
