/**
 * Bridge between the mock AI agent service and the canvas.
 *
 * Listens for `ai-agent:action` CustomEvents dispatched by the mock,
 * then adds AI nodes to the canvas via onNodesChange and pushes
 * chat messages to the shared AI message store.
 */

import * as React from "react"
import type { NodeChange, Edge } from "@xyflow/react"
import type { CanvasObjectNode } from "@/modules/Canvas/components/canvas/primitives/schema"
import { aiChatStore } from "./use-ai-chat-messages"

type UseAiMockBridgeOptions = {
  onNodesChange: (changes: NodeChange<CanvasObjectNode>[]) => void
}

export function useAiMockBridge({ onNodesChange }: UseAiMockBridgeOptions) {
  React.useEffect(() => {
    function handleAction(event: Event) {
      const detail = (event as CustomEvent).detail as {
        roomId: string
        actionId: string
        commandId: string
        requestedBy: string
        nodes: Array<{
          id: string
          type: string
          position: { x: number; y: number }
          width: number
          height: number
          data: Record<string, unknown>
        }>
        edges: Array<Record<string, unknown>>
        chatMessage: string
      }

      // Add AI nodes to the canvas
      if (detail.nodes.length > 0) {
        const changes: NodeChange<CanvasObjectNode>[] = detail.nodes.map(
          (node) => ({
            type: "add" as const,
            item: {
              id: node.id,
              type: node.type as CanvasObjectNode["type"],
              position: node.position,
              style: { width: node.width, height: node.height },
              data: node.data as CanvasObjectNode["data"],
            } as CanvasObjectNode,
          }),
        )
        onNodesChange(changes)
      }

      // Push AI chat message
      if (detail.chatMessage) {
        aiChatStore.addMessage({
          id: `ai-msg-${detail.actionId}`,
          type: "agent",
          author: "AI Agent",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          text: detail.chatMessage,
          timestamp: Date.now(),
          source: "chat",
        })
      }
    }

    window.addEventListener("ai-agent:action", handleAction)
    return () => window.removeEventListener("ai-agent:action", handleAction)
  }, [onNodesChange])
}
