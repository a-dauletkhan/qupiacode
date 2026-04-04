/**
 * Helpers for detecting and working with AI-generated canvas objects.
 *
 * AI nodes carry a `_ai` field in their data. These helpers let the frontend
 * distinguish AI nodes from user nodes and read their approval status.
 */

import type { Node, Edge } from "@xyflow/react"
import type { AiMetadata, AiActionStatus } from "../types"

type NodeData = Record<string, unknown> & { _ai?: AiMetadata }
type EdgeData = Record<string, unknown> & { _ai?: AiMetadata }

/** Check if a node was created by the AI agent. */
export function isAiNode(node: Node): boolean {
  const data = node.data as NodeData | undefined
  return data?._ai != null
}

/** Check if an edge was created by the AI agent. */
export function isAiEdge(edge: Edge): boolean {
  const data = edge.data as EdgeData | undefined
  return data?._ai != null
}

/** Get AI metadata from a node, or null if it's a user node. */
export function getAiMeta(node: Node | { data: Record<string, unknown> }): AiMetadata | null {
  const data = node.data as NodeData | undefined
  return data?._ai ?? null
}

/** Get AI metadata from an edge, or null if it's a user edge. */
export function getAiEdgeMeta(edge: Edge): AiMetadata | null {
  const data = edge.data as EdgeData | undefined
  return data?._ai ?? null
}

/** Check if an AI node is still pending approval. */
export function isAiPending(node: Node): boolean {
  return getAiMeta(node)?.status === "pending"
}

/** Check if an AI node has been approved. */
export function isAiApproved(node: Node): boolean {
  return getAiMeta(node)?.status === "approved"
}

/** Get the approval status of an AI node. */
export function getAiStatus(node: Node): AiActionStatus | null {
  return getAiMeta(node)?.status ?? null
}

/**
 * Group AI nodes by their actionId.
 * Useful for approve/reject-all of a single AI action.
 */
export function groupByAction(nodes: Node[]): Map<string, Node[]> {
  const groups = new Map<string, Node[]>()
  for (const node of nodes) {
    const meta = getAiMeta(node)
    if (!meta) continue
    const existing = groups.get(meta.actionId) ?? []
    existing.push(node)
    groups.set(meta.actionId, existing)
  }
  return groups
}

/**
 * Collect all nodeIds and edgeIds for a given actionId.
 * Used when sending feedback to the backend.
 */
export function collectActionIds(
  actionId: string,
  nodes: Node[],
  edges: Edge[],
): { nodeIds: string[]; edgeIds: string[] } {
  const nodeIds = nodes
    .filter((n) => getAiMeta(n)?.actionId === actionId)
    .map((n) => n.id)

  const edgeIds = edges
    .filter((e) => getAiEdgeMeta(e)?.actionId === actionId)
    .map((e) => e.id)

  return { nodeIds, edgeIds }
}
