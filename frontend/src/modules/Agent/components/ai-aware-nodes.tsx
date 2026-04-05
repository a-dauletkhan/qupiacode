/**
 * AI-aware wrappers around each canvas node type.
 *
 * These replace the entries in the `nodeTypes` map. For normal nodes they
 * render the original component unchanged. For nodes that carry `_ai`
 * metadata they add the AiNodeOverlay (badge + approve/reject bar).
 */

import * as React from "react"
import type { Node, NodeProps } from "@xyflow/react"
import type {
  ShapeNode,
  TextNode,
  StickyNoteNode,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import { ShapeNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/primitive-node"
import { StickyNoteNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/sticky-note-node"
import { TextNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/text-node"
import { AiNodeOverlay } from "./ai-node-overlay"
import { useAiAgentOptional } from "../context/ai-agent-context"
import { getAiMeta } from "../utils/ai-node-helpers"
import type { AiMetadata } from "../types"

// ---------------------------------------------------------------------------
// Generic wrapper factory
// ---------------------------------------------------------------------------

function withAiOverlay<N extends Node<Record<string, unknown>>>(
  OriginalComponent: React.ComponentType<NodeProps<N>>,
  displayName: string,
) {
  const Wrapped = React.memo(function AiAwareNode(props: NodeProps<N>) {
    const aiMeta = getAiMeta({ id: props.id, data: props.data as Record<string, unknown> }) as AiMetadata | null
    const agent = useAiAgentOptional()

    if (!aiMeta) {
      return <OriginalComponent {...props} />
    }

    if (aiMeta.status === "approved") {
      return (
        <AiNodeOverlay
          status="approved"
          persona={aiMeta.persona}
          personaColor={aiMeta.personaColor}
          onApprove={() => {}}
          onReject={() => {}}
        >
          <OriginalComponent {...props} />
        </AiNodeOverlay>
      )
    }

    function handleApprove() {
      if (!agent || !aiMeta) return
      const pendingAction = agent.getPendingAction(aiMeta.actionId)
      const matchingAction = agent.queue.recentActions.find((action) => action.actionId === aiMeta.actionId)
      const nodeIds =
        pendingAction?.actions
          .filter((action) => action.type === "create_node" || action.type === "update_node")
          .map((action) => ("nodeId" in action ? action.nodeId : ""))
          .filter(Boolean) ??
        matchingAction?.nodeIds ??
        [props.id]
      const edgeIds =
        pendingAction?.actions
          .filter((action) => action.type === "create_edge")
          .map((action) => action.edgeId) ??
        matchingAction?.edgeIds ??
        []
      console.info("[ai-agent] approve clicked", {
        actionId: aiMeta.actionId,
        nodeIds,
        edgeIds,
        commandId: aiMeta.commandId,
      })
      agent.approve(aiMeta.actionId, nodeIds, edgeIds)
      agent._notifyCanvasAction({
        type: "approve",
        actionId: aiMeta.actionId,
        nodeIds,
        edgeIds,
        pendingAction,
      })
    }

    function handleReject() {
      if (!agent || !aiMeta) return
      const pendingAction = agent.getPendingAction(aiMeta.actionId)
      const matchingAction = agent.queue.recentActions.find((action) => action.actionId === aiMeta.actionId)
      const nodeIds =
        pendingAction?.actions
          .filter((action) => action.type === "create_node" || action.type === "update_node")
          .map((action) => ("nodeId" in action ? action.nodeId : ""))
          .filter(Boolean) ??
        matchingAction?.nodeIds ??
        [props.id]
      const edgeIds =
        pendingAction?.actions
          .filter((action) => action.type === "create_edge")
          .map((action) => action.edgeId) ??
        matchingAction?.edgeIds ??
        []
      console.info("[ai-agent] reject clicked", {
        actionId: aiMeta.actionId,
        nodeIds,
        edgeIds,
        commandId: aiMeta.commandId,
      })
      agent.reject(aiMeta.actionId, nodeIds, edgeIds)
      agent._notifyCanvasAction({
        type: "reject",
        actionId: aiMeta.actionId,
        nodeIds,
        edgeIds,
        pendingAction,
      })
    }

    return (
      <AiNodeOverlay
        status={aiMeta.status}
        persona={aiMeta.persona}
        personaColor={aiMeta.personaColor}
        onApprove={handleApprove}
        onReject={handleReject}
      >
        <OriginalComponent {...props} />
      </AiNodeOverlay>
    )
  })

  Wrapped.displayName = displayName
  return Wrapped
}

// ---------------------------------------------------------------------------
// Exported AI-aware node types
// ---------------------------------------------------------------------------

export const AiAwareShapeNode = withAiOverlay<ShapeNode>(ShapeNodeCard, "AiAwareShapeNode")
export const AiAwareTextNode = withAiOverlay<TextNode>(TextNodeCard, "AiAwareTextNode")
export const AiAwareStickyNoteNode = withAiOverlay<StickyNoteNode>(StickyNoteNodeCard, "AiAwareStickyNoteNode")

/**
 * Drop-in replacement for the `nodeTypes` map in FlowCanvas.
 */
export const aiAwareNodeTypes = {
  shape: AiAwareShapeNode,
  text: AiAwareTextNode,
  sticky_note: AiAwareStickyNoteNode,
}
