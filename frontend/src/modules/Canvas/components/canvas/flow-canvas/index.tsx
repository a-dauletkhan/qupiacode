import * as React from "react"
import { Cursors, useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  useCanRedo,
  useCanUndo,
  useRedo,
  useUndo,
} from "@liveblocks/react/suspense"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"
import "@liveblocks/react-ui/styles.css"
import "@liveblocks/react-flow/styles.css"

import { CanvasObjectInspector } from "@/modules/Canvas/components/canvas/flow-canvas/canvas-object-inspector"
import { CanvasEditorProvider } from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
// Node type components are now wrapped by AI-aware nodes in Agent module
import {
  initialEdges,
  initialNodes,
} from "@/modules/Canvas/components/canvas/primitives/mock-data"
import {
  DRAFT_CANVAS_OBJECT_ID,
  createShapeNode,
  createStickyNoteNode,
  createTextNode,
  expandCanvasRect,
  getCanvasObjectSize,
  isImagePlaceholderNode,
  isCanvasCreationTool,
  normalizeCanvasRect,
  type CanvasCreationTool,
  type CanvasEditorDefaults,
  type CanvasObjectNode,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import "@/modules/Canvas/components/canvas/flow-canvas/styles.css"
import { AgentPresence } from "@/modules/Agent/components/agent-presence"
import { aiAwareNodeTypes } from "@/modules/Agent/components/ai-aware-nodes"
import { AiAskButton } from "@/modules/Agent/components/ai-ask-button"
import { AiPromptInput } from "@/modules/Agent/components/ai-prompt-input"
import { AiQueueStatus } from "@/modules/Agent/components/ai-queue-status"
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"
import type { AiPendingAction, CanvasSnapshot } from "@/modules/Agent/types"
// import { useAiMockBridge } from "@/modules/Agent/hooks/use-ai-mock-bridge"
import { cn } from "@/lib/utils"
import { AvatarStack } from "@liveblocks/react-ui"

type FlowCanvasProps = {
  className?: string
  overlay?: React.ReactNode
  activeTool: ToolId
  editorDefaults: CanvasEditorDefaults
  onActiveToolChange: (tool: ToolId) => void
}

type DraftCreation = {
  pointerId: number
  start: { x: number; y: number }
  tool: CanvasCreationTool
}

const nodeTypes = aiAwareNodeTypes
const FLOW_STORAGE_KEY = "flow"

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function FlowCanvasInner({
  className,
  overlay,
  activeTool,
  editorDefaults,
  onActiveToolChange,
}: FlowCanvasProps) {
  const sectionRef = React.useRef<HTMLElement | null>(null)
<<<<<<< Updated upstream
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasObjectNode, Edge>({
      suspense: true,
      nodes: {
        initial: initialNodes,
      },
      edges: {
        initial: initialEdges,
      },
    })
  const [draftCreation, setDraftCreation] =
    React.useState<DraftCreation | null>(null)
  const [draftNode, setDraftNode] = React.useState<CanvasObjectNode | null>(
=======
  const hasMeasuredCanvasRef = React.useRef(false)
  const previousToolRef = React.useRef<ToolId | null>(null)
  const suppressSemanticEventsRef = React.useRef(false)
  const miniMapActivityTimeoutRef = React.useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null)
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDelete,
  } = useLiveblocksFlow<CanvasObjectNode, Edge>({
    suspense: true,
    storageKey: FLOW_STORAGE_KEY,
    nodes: {
      initial: initialNodes,
    },
    edges: {
      initial: initialEdges,
    },
  })
  const [isMiniMapVisible, setIsMiniMapVisible] = React.useState(true)
  const [draftCreation, setDraftCreation] = React.useState<DraftCreation | null>(
>>>>>>> Stashed changes
    null
  )
  const [selectedObjectIds, setSelectedObjectIds] = React.useState<string[]>([])
  const [editingObjectId, setEditingObjectId] = React.useState<string | null>(
    null
  )
  const [inspectorOpen, setInspectorOpen] = React.useState(false)
  const [inspectedObjectId, setInspectedObjectId] = React.useState<
    string | null
  >(null)
  const [aiPromptOpen, setAiPromptOpen] = React.useState(false)
  const [aiPromptPosition, setAiPromptPosition] = React.useState<{
    x: number
    y: number
  } | null>(null)
  const undo = useUndo()
  const redo = useRedo()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  const aiAgent = useAiAgentOptional()
  // useAiMockBridge({ onNodesChange })  // Mock bridge disabled — Liveblocks handles AI node sync

  // Listen for approve/reject actions from AI-aware nodes
  React.useEffect(() => {
    if (!aiAgent) return
    return aiAgent.registerCanvasAction((action) => {
      if (action.type === "reject") {
        // Remove rejected nodes from canvas
<<<<<<< Updated upstream
        const removeChanges: NodeChange<CanvasObjectNode>[] =
          action.nodeIds.map((id) => ({ type: "remove", id }))
        onNodesChange(removeChanges)
=======
        const removeChanges: NodeChange<CanvasObjectNode>[] = action.nodeIds.map(
          (id) => ({ type: "remove", id }),
        )
        withSuppressedSemanticEvents(() => onNodesChange(removeChanges))
        if (action.edgeIds.length > 0) {
          withSuppressedSemanticEvents(() =>
            onEdgesChange(action.edgeIds.map((id) => ({ type: "remove", id }))),
          )
        }
>>>>>>> Stashed changes
      } else if (action.type === "approve") {
        // Update node data to mark as approved
        for (const nodeId of action.nodeIds) {
          const node = nodes.find((n) => n.id === nodeId)
          if (!node) continue
          const data = node.data as Record<string, unknown>
          const aiField = data._ai as Record<string, unknown> | undefined
          if (!aiField) continue
          withSuppressedSemanticEvents(() => onNodesChange([
            {
              type: "replace",
              id: nodeId,
              item: {
                ...node,
                data: {
                  ...node.data,
                  _ai: { ...aiField, status: "approved" },
                },
              } as unknown as CanvasObjectNode,
            },
          ]))
        }
      }
    })
  }, [aiAgent, nodes, onEdgesChange, onNodesChange])

  const reactFlow = useReactFlow<CanvasObjectNode, Edge>()
  const viewport = useViewport()

  const withSuppressedSemanticEvents = React.useCallback((fn: () => void) => {
    suppressSemanticEventsRef.current = true
    try {
      fn()
    } finally {
      window.setTimeout(() => {
        suppressSemanticEventsRef.current = false
      }, 0)
    }
  }, [])

  const buildCanvasSnapshot = React.useCallback((): CanvasSnapshot => {
    const visibleNodes = nodes
      .filter((node) => !node.data.draft)
      .map((node) => {
        const size = getCanvasObjectSize(node)
        return {
          id: node.id,
          type: node.type,
          position: node.position,
          parentId: node.parentId ?? null,
          width: node.width ?? size.width,
          height: node.height ?? size.height,
          data: { ...node.data },
        }
      })

    return {
      roomId: aiAgent?.roomId ?? "unknown-room",
      projectId: aiAgent?.roomId ?? "unknown-room",
      nodes: visibleNodes,
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        data: edge.data as Record<string, unknown> | undefined,
      })),
      selectedNodeIds: selectedObjectIds,
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    }
  }, [aiAgent?.roomId, edges, nodes, selectedObjectIds, viewport.x, viewport.y, viewport.zoom])

  React.useEffect(() => {
    if (!aiAgent) return
    return aiAgent.registerCanvasSnapshotProvider(buildCanvasSnapshot)
  }, [aiAgent, buildCanvasSnapshot])

  React.useEffect(() => {
    if (!aiAgent) return

    return aiAgent.registerPendingActionApplier((pendingAction: AiPendingAction) => {
      const nextNodes: NodeChange<CanvasObjectNode>[] = []
      const nextEdges: EdgeChange<Edge>[] = []

      for (const action of pendingAction.actions) {
        if (action.type === "create_node") {
          nextNodes.push({
            type: "add",
            item: buildNodeFromPendingAction(action, pendingAction.actionId, aiAgent.userId),
          })
        } else {
          nextEdges.push({
            type: "add",
            item: {
              id: action.edgeId,
              source: action.source,
              target: action.target,
              label: action.label,
              data: {
                _ai: {
                  actionId: pendingAction.actionId,
                  commandId: null,
                  requestedBy: aiAgent.userId,
                  status: "pending",
                  createdAt: Date.now(),
                },
              },
            } as Edge,
          })
        }
      }

      withSuppressedSemanticEvents(() => {
        if (nextNodes.length > 0) {
          onNodesChange(nextNodes)
        }
        if (nextEdges.length > 0) {
          onEdgesChange(nextEdges)
        }
      })
    })
  }, [aiAgent, onEdgesChange, onNodesChange, withSuppressedSemanticEvents])

  const renderedNodes = React.useMemo(
    () => (draftNode ? [...nodes, draftNode] : nodes),
    [draftNode, nodes]
  )

  const isValidConnection = React.useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) {
        return false
      }

      if (connection.source === connection.target) {
        return false
      }

      return !edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle &&
          edge.targetHandle === connection.targetHandle
      )
    },
    [edges]
  )

  const updateCanvasObject = React.useCallback(
    (id: string, updater: (node: CanvasObjectNode) => CanvasObjectNode) => {
      const currentNode = nodes.find((node) => node.id === id)

      if (!currentNode) {
        return
      }

      onNodesChange([
        {
          id,
          item: updater(currentNode),
          type: "replace",
        },
      ])
    },
    [nodes, onNodesChange]
  )

  const finishEditing = React.useCallback(() => {
    if (editingObjectId && aiAgent) {
      const editedNode = nodes.find((node) => node.id === editingObjectId)
      if (editedNode && !suppressSemanticEventsRef.current) {
        aiAgent.pushEvent({
          type: "canvas.node.content_committed",
          data: {
            nodeId: editedNode.id,
            nodeType: editedNode.type,
            content: editedNode.data.content,
          },
        })
      }
    }
    setEditingObjectId(null)
  }, [aiAgent, editingObjectId, nodes])

  const startEditing = React.useCallback((id: string) => {
    setEditingObjectId(id)
  }, [])

  const handleNodesChange = React.useCallback(
    (changes: NodeChange<CanvasObjectNode>[]) => {
      const syncedChanges = changes.filter((change) =>
        change.type === "add"
          ? change.item.id !== DRAFT_CANVAS_OBJECT_ID
          : change.id !== DRAFT_CANVAS_OBJECT_ID
      )

      if (syncedChanges.length > 0) {
        onNodesChange(syncedChanges)
        if (aiAgent && !suppressSemanticEventsRef.current) {
          for (const change of syncedChanges) {
            if (change.type === "add" && !change.item.data.draft) {
              aiAgent.pushEvent({
                type: "canvas.node.created",
                data: {
                  nodeId: change.item.id,
                  nodeType: change.item.type,
                  position: change.item.position,
                },
              })
            }

            if (
              change.type === "position" &&
              change.position &&
              change.dragging === false
            ) {
              aiAgent.pushEvent({
                type: "canvas.node.drag_ended",
                data: {
                  nodeId: change.id,
                  position: change.position,
                },
              })
            }
          }
        }
      }

      if (
        changes.some(
          (change) => change.type === "remove" && change.id === editingObjectId
        )
      ) {
        finishEditing()
      }
    },
    [aiAgent, editingObjectId, finishEditing, onNodesChange]
  )

  const handleEdgesChange = React.useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChange(changes)

      if (!aiAgent || suppressSemanticEventsRef.current) {
        return
      }

      for (const change of changes) {
        if (change.type === "add") {
          aiAgent.pushEvent({
            type: "canvas.edge.created",
            data: {
              edgeId: change.item.id,
              source: change.item.source,
              target: change.item.target,
              label: change.item.label,
            },
          })
        }

        if (change.type === "remove") {
          aiAgent.pushEvent({
            type: "canvas.edge.deleted",
            data: {
              edgeId: change.id,
            },
          })
        }
      }
    },
    [aiAgent, onEdgesChange],
  )

  const handleConnect = React.useCallback(
    (connection: Connection) => {
      onConnect(connection)
    },
    [onConnect],
  )

  const handleDelete = React.useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }: { nodes: CanvasObjectNode[]; edges: Edge[] }) => {
      onDelete({ nodes: deletedNodes, edges: deletedEdges })
      if (!aiAgent || suppressSemanticEventsRef.current || deletedEdges.length === 0) {
        return
      }

      for (const edge of deletedEdges) {
        aiAgent.pushEvent({
          type: "canvas.edge.deleted",
          data: {
            edgeId: edge.id,
          },
        })
      }
    },
    [aiAgent, onDelete],
  )

  const selectedObject = React.useMemo(() => {
    if (selectedObjectIds.length !== 1) {
      return null
    }

    return (
      nodes.find(
        (node) =>
          node.id === selectedObjectIds[0] &&
          node.id !== DRAFT_CANVAS_OBJECT_ID &&
          !node.data.draft
      ) ?? null
    )
  }, [nodes, selectedObjectIds])

  const handleSelectionChange = React.useCallback<
    OnSelectionChangeFunc<CanvasObjectNode, Edge>
  >(
    ({ nodes: selectedNodes }) => {
      const nextIds = selectedNodes
        .filter((node) => node.id !== DRAFT_CANVAS_OBJECT_ID)
        .map((node) => node.id)

      if (nextIds.length !== 1 || nextIds[0] !== inspectedObjectId) {
        setInspectorOpen(false)
      }

<<<<<<< Updated upstream
      // Push selection events to AI event batcher
      if (aiAgent) {
        if (nextIds.length > 0) {
          aiAgent.pushEvent({
            type: "node:selected",
            data: { nodeIds: nextIds },
          })
        } else {
          aiAgent.pushEvent({ type: "node:deselected", data: {} })
        }
=======
      if (aiAgent && !suppressSemanticEventsRef.current) {
        aiAgent.pushEvent({
          type: "canvas.selection.changed",
          data: { nodeIds: nextIds },
        })
>>>>>>> Stashed changes
      }

      // Close AI prompt only when selection is fully cleared
      if (nextIds.length === 0) {
        setAiPromptOpen(false)
      }

      setSelectedObjectIds((currentIds) =>
        areStringArraysEqual(currentIds, nextIds) ? currentIds : nextIds
      )
    },
    [inspectedObjectId, aiAgent]
  )

  React.useEffect(() => {
    if (!selectedObjectIds.includes(editingObjectId ?? "")) {
      setEditingObjectId((currentEditingObjectId) =>
        selectedObjectIds.includes(currentEditingObjectId ?? "")
          ? currentEditingObjectId
          : null
      )
    }
  }, [editingObjectId, selectedObjectIds])

  React.useEffect(() => {
    if (selectedObjectIds.length !== 1) {
      setInspectorOpen(false)
    }
  }, [selectedObjectIds])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        isEditableTarget(event.target)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const wantsUndo = key === "z" && !event.shiftKey
      const wantsRedo = (key === "z" && event.shiftKey) || key === "y"

      if (wantsUndo) {
        if (!canUndo) {
          return
        }

        event.preventDefault()
        undo()
        return
      }

      if (!wantsRedo || !canRedo) {
        return
      }

      event.preventDefault()
      redo()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [canRedo, canUndo, redo, undo])

  const inspectorAnchor = React.useMemo(() => {
    if (!selectedObject || !sectionRef.current) {
      return null
    }

    const { width, height } = getCanvasObjectSize(selectedObject)
    const leftScreenPosition = reactFlow.flowToScreenPosition({
      x: selectedObject.position.x,
      y: selectedObject.position.y,
    })
    const rightScreenPosition = reactFlow.flowToScreenPosition({
      x: selectedObject.position.x + width,
      y: selectedObject.position.y,
    })
    const bounds = sectionRef.current.getBoundingClientRect()
    const leftSpace = leftScreenPosition.x - bounds.left
    const rightSpace = bounds.right - rightScreenPosition.x
    const side: "left" | "right" = rightSpace >= leftSpace ? "right" : "left"

    return {
      left:
        side === "right"
          ? clamp(
              rightScreenPosition.x - bounds.left + 12,
              24,
              bounds.width - 24
            )
          : clamp(
              leftScreenPosition.x - bounds.left - 12,
              24,
              bounds.width - 24
            ),
      top: clamp(leftScreenPosition.y - bounds.top, 24, bounds.height - 24),
      side,
      width,
      height,
    }
  }, [reactFlow, selectedObject, viewport.x, viewport.y, viewport.zoom])

  const handleNodeContextMenu = React.useCallback<
    NodeMouseHandler<CanvasObjectNode>
  >(
    (event, node) => {
      event.preventDefault()
      finishEditing()
      setSelectedObjectIds([node.id])

      if (isImagePlaceholderNode(node)) {
        setInspectedObjectId(null)
        setInspectorOpen(false)
        return
      }

      setInspectedObjectId(node.id)
      setInspectorOpen(true)
    },
    [finishEditing]
  )

  const handleAskAiClick = React.useCallback(() => {
    if (selectedObjectIds.length === 0 || !aiAgent) return
    console.info("[ai-agent] Ask AI button clicked", {
      selectedNodeIds: selectedObjectIds,
      nodeCount: selectedObjectIds.length,
    })
    const bounds = sectionRef.current?.getBoundingClientRect()
    if (!bounds) return
    setAiPromptPosition({
      x: bounds.width / 2 - 144,
      y: bounds.height / 2 - 60,
    })
    setAiPromptOpen(true)
  }, [selectedObjectIds, aiAgent])

  const handleAiPromptSubmit = React.useCallback(
    (message: string) => {
      if (!aiAgent) return
      console.info("[ai-agent] canvas prompt submitted", {
        message,
        source: "canvas_context_menu",
      })
      aiAgent.sendCommand(message, {
        source: "canvas_context_menu",
      })
    },
<<<<<<< Updated upstream
    [aiAgent, selectedObjectIds, viewport]
=======
    [aiAgent],
>>>>>>> Stashed changes
  )

  const handleNodeDoubleClick = React.useCallback<
    NodeMouseHandler<CanvasObjectNode>
  >(
    (event, node) => {
      if (
        (activeTool !== "selection" && activeTool !== "hand") ||
        node.data.draft
      ) {
        return
      }

      event.preventDefault()
      setSelectedObjectIds([node.id])
      setInspectedObjectId(null)
      setInspectorOpen(false)
      startEditing(node.id)
    },
    [activeTool, startEditing]
  )

  const buildNodeFromTool = React.useCallback(
    (
      tool: CanvasCreationTool,
      rect: { x: number; y: number; width: number; height: number },
      options?: {
        draft?: boolean
        id?: string
        selected?: boolean
      }
    ) => {
      if (tool === "text") {
        return createTextNode({
          id: options?.id ?? createCanvasObjectId("text"),
          rect,
          draft: options?.draft,
          selected: options?.selected,
          preset: editorDefaults.text,
        })
      }

      if (tool === "sticky_note") {
        return createStickyNoteNode({
          id: options?.id ?? createCanvasObjectId("sticky-note"),
          rect,
          draft: options?.draft,
          selected: options?.selected,
          preset: editorDefaults.stickyNote,
        })
      }

      if (tool === "image") {
        return createShapeNode({
          id: options?.id ?? createCanvasObjectId("image"),
          shapeKind: "rectangle",
          sourceTool: "image",
          rect,
          draft: options?.draft,
          selected: options?.selected,
          preset: editorDefaults.shape,
        })
      }

      return createShapeNode({
        id: options?.id ?? createCanvasObjectId(tool),
        shapeKind: tool,
        rect,
        draft: options?.draft,
        selected: options?.selected,
        preset: editorDefaults.shape,
      })
    },
    [editorDefaults]
  )

  const syncDraftNode = React.useCallback(
    (endPoint: { x: number; y: number }) => {
      if (!draftCreation) {
        return
      }

      const rect = normalizeCanvasRect(draftCreation.start, endPoint)

      setDraftNode(
        buildNodeFromTool(
          draftCreation.tool,
          {
            ...getCommittedRect(draftCreation.tool, rect, draftCreation.start),
            width: Math.max(rect.width, 1),
            height: Math.max(rect.height, 1),
          },
          {
            draft: true,
            id: DRAFT_CANVAS_OBJECT_ID,
          }
        )
      )
    },
    [buildNodeFromTool, draftCreation]
  )

  const clearDraftNode = React.useCallback(() => {
    setDraftCreation(null)
    setDraftNode(null)
  }, [])

  const commitDraftNode = React.useCallback(
    (endPoint: { x: number; y: number }) => {
      if (!draftCreation) {
        return
      }

      const nextRect = normalizeCanvasRect(draftCreation.start, endPoint)
      const committedRect = getCommittedRect(
        draftCreation.tool,
        nextRect,
        draftCreation.start
      )
      const createdNode = buildNodeFromTool(draftCreation.tool, committedRect, {
        selected: true,
      })

      const selectionChanges: NodeChange<CanvasObjectNode>[] =
        selectedObjectIds.map((id) => ({
          id,
          selected: false,
          type: "select",
        }))

      onNodesChange([
        ...selectionChanges,
        {
          item: createdNode,
          type: "add",
        },
      ])

      setSelectedObjectIds([createdNode.id])
      setDraftNode(null)
      setDraftCreation(null)

      setEditingObjectId(createdNode.id)
      onActiveToolChange("selection")
    },
    [
      buildNodeFromTool,
      draftCreation,
      onActiveToolChange,
      onNodesChange,
      selectedObjectIds,
    ]
  )

  const handleCanvasPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isCanvasCreationTool(activeTool) || event.button !== 0) {
        return
      }

      if (!isPaneTarget(event.target)) {
        return
      }

      event.preventDefault()

      const start = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      setDraftCreation({
        pointerId: event.pointerId,
        start,
        tool: activeTool,
      })
      setSelectedObjectIds([])
      finishEditing()
    },
    [activeTool, finishEditing, reactFlow]
  )

  React.useEffect(() => {
    if (!draftCreation) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== draftCreation.pointerId) {
        return
      }

      syncDraftNode(
        reactFlow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      )
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== draftCreation.pointerId) {
        return
      }

      commitDraftNode(
        reactFlow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
      )
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [commitDraftNode, draftCreation, reactFlow, syncDraftNode])

  React.useEffect(() => {
    if (!isCanvasCreationTool(activeTool)) {
      clearDraftNode()
    }
  }, [activeTool, clearDraftNode])

  React.useEffect(() => {
    if (!aiAgent) {
      previousToolRef.current = activeTool
      return
    }

    if (previousToolRef.current && previousToolRef.current !== activeTool) {
      aiAgent.pushEvent({
        type: "canvas.tool.changed",
        data: {
          from: previousToolRef.current,
          to: activeTool,
        },
      })
    }

    previousToolRef.current = activeTool
  }, [activeTool, aiAgent])

  return (
    <CanvasEditorProvider
      value={{
        editingObjectId,
        startEditing,
        finishEditing,
        updateCanvasObject,
      }}
    >
      <section
        ref={sectionRef}
        className={cn(
          "relative flex h-full w-full overflow-hidden border-l border-border/60 bg-background",
          className
        )}
        aria-label="Canvas flow workspace"
        onPointerDownCapture={handleCanvasPointerDown}
      >
        <div className="canvas-grid-backdrop" aria-hidden="true" />

        <div className="relative h-full w-full">
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onDelete={handleDelete}
            onPaneClick={() => {
              finishEditing()
              setInspectedObjectId(null)
              setInspectorOpen(false)
              setAiPromptOpen(false)
            }}
            onNodeContextMenu={handleNodeContextMenu}
            onNodeDoubleClick={handleNodeDoubleClick}
            onSelectionChange={handleSelectionChange}
            connectionMode={ConnectionMode.Loose}
            nodesConnectable={activeTool === "selection" && !editingObjectId}
            isValidConnection={isValidConnection}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.5}
            maxZoom={1.6}
            panOnDrag={activeTool === "hand"}
            nodesDraggable={activeTool === "selection" && !editingObjectId}
            selectionOnDrag={activeTool === "selection"}
            selectNodesOnDrag={activeTool === "selection"}
            elementsSelectable={
              activeTool === "selection" || Boolean(editingObjectId)
            }
            className={cn(
              "canvas-flow",
              isCanvasCreationTool(activeTool) && "canvas-flow-drawing",
              activeTool === "hand" && "canvas-flow-panning"
            )}
            proOptions={{ hideAttribution: true }}
          >
            <Panel position="bottom-left" className="canvas-panel">
              <div className="flex items-center gap-6 text-xs tracking-[0.16em] text-muted-foreground uppercase">
                <span>
                  {nodes.filter((node) => !node.data.draft).length} objects
                </span>
                <span>{activeTool}</span>
                <span>{selectedObjectIds.length} selected</span>
                {aiAgent ? (
                  <AiQueueStatus
                    agentStatus={aiAgent.queue.agentStatus}
                    queueLength={aiAgent.queue.queue.length}
                    currentUserName={aiAgent.queue.currentCommand?.userName}
                  />
                ) : (
                  <AgentPresence />
                )}
              </div>
            </Panel>

            <Controls className="canvas-controls" showInteractive={false} />
            <Background
              id="canvas-grid"
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.4}
              color="color-mix(in srgb, var(--color-border) 88%, transparent)"
            />
            <Cursors
              className="relative"
              style={{ width: "100vw", height: "100vh", pointerEvents: "none" }}
            >
              <AvatarStack
                className="absolute top-14 left-4"
                style={{ pointerEvents: "auto" }}
              />
            </Cursors>
          </ReactFlow>
        </div>

        {aiPromptOpen &&
        aiPromptPosition &&
        selectedObjectIds.length > 0 &&
        aiAgent ? (
          <div
            className="absolute z-40"
            style={{ left: aiPromptPosition.x, top: aiPromptPosition.y }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <AiPromptInput
              selectedCount={selectedObjectIds.length}
              onSubmit={handleAiPromptSubmit}
              onClose={() => setAiPromptOpen(false)}
            />
          </div>
        ) : null}

        {inspectorOpen &&
        inspectorAnchor &&
        selectedObject &&
        selectedObject.id === inspectedObjectId ? (
          <CanvasObjectInspector
            anchor={inspectorAnchor}
            side={inspectorAnchor.side}
            object={selectedObject}
            onClose={() => {
              setInspectedObjectId(null)
              setInspectorOpen(false)
            }}
            onUpdateCanvasObject={updateCanvasObject}
          />
        ) : null}

        {overlay ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
            <div className="pointer-events-auto flex justify-center">
              {overlay}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
          <div className="pointer-events-auto">
            <AiAskButton
              visible={
                selectedObjectIds.length > 0 && aiAgent != null && !aiPromptOpen
              }
              selectedCount={selectedObjectIds.length}
              onClick={handleAskAiClick}
            />
          </div>
        </div>
      </section>
    </CanvasEditorProvider>
  )
}

function buildNodeFromPendingAction(
  action: Extract<AiPendingAction["actions"][number], { type: "create_node" }>,
  actionId: string,
  requestedBy: string,
): CanvasObjectNode {
  const rect = {
    x: action.position.x,
    y: action.position.y,
    width:
      action.width ??
      (action.nodeType === "sticky_note"
        ? 280
        : action.nodeType === "text"
          ? 300
          : action.shapeKind === "ellipse"
            ? 260
            : 220),
    height:
      action.height ??
      (action.nodeType === "sticky_note"
        ? 168
        : action.nodeType === "text"
          ? 80
          : action.shapeKind === "ellipse"
            ? 124
            : 112),
  }

  const aiMeta = {
    actionId,
    commandId: null,
    requestedBy,
    status: "pending" as const,
    createdAt: Date.now(),
  }

  if (action.nodeType === "shape") {
    const node = createShapeNode({
      id: action.nodeId,
      shapeKind: action.shapeKind ?? "rectangle",
      rect,
      label: typeof action.content.label === "string" ? action.content.label : "",
      preset: {
        color: typeof action.style.color === "string" ? action.style.color : "oklch(0.768 0.233 130.85)",
        paintStyle:
          action.style.paintStyle === "outline" ||
          action.style.paintStyle === "sketch" ||
          action.style.paintStyle === "hatch"
            ? action.style.paintStyle
            : "solid",
        strokeWidth: typeof action.style.strokeWidth === "number" ? action.style.strokeWidth : 2,
      },
    })
    return {
      ...node,
      parentId: action.parentId ?? undefined,
      data: {
        ...node.data,
        zIndex: action.zIndex ?? 10,
        _ai: aiMeta,
      },
    }
  }

  if (action.nodeType === "text") {
    const node = createTextNode({
      id: action.nodeId,
      rect,
      text: typeof action.content.text === "string" ? action.content.text : "",
      preset: {
        color: typeof action.style.color === "string" ? action.style.color : "oklch(0.145 0 0)",
        fontSize: typeof action.style.fontSize === "number" ? action.style.fontSize : 24,
        fontWeight:
          action.style.fontWeight === "medium" || action.style.fontWeight === "bold"
            ? action.style.fontWeight
            : "normal",
        align:
          action.style.align === "center" || action.style.align === "right"
            ? action.style.align
            : "left",
      },
    })
    return {
      ...node,
      parentId: action.parentId ?? undefined,
      data: {
        ...node.data,
        zIndex: action.zIndex ?? 10,
        _ai: aiMeta,
      },
    }
  }

  const node = createStickyNoteNode({
    id: action.nodeId,
    rect,
    text: typeof action.content.text === "string" ? action.content.text : "",
    preset: {
      color: typeof action.style.color === "string" ? action.style.color : "oklch(0.92 0.17 122)",
      textColor:
        typeof action.style.textColor === "string" ? action.style.textColor : "oklch(0.145 0 0)",
      fontSize: typeof action.style.fontSize === "number" ? action.style.fontSize : 20,
    },
  })
  return {
    ...node,
    parentId: action.parentId ?? undefined,
    data: {
      ...node.data,
      zIndex: action.zIndex ?? 10,
      _ai: aiMeta,
    },
  }
}

function getCommittedRect(
  tool: CanvasCreationTool,
  rect: { x: number; y: number; width: number; height: number },
  start: { x: number; y: number }
) {
  const defaults =
    tool === "text"
      ? { width: 220, height: 72, minWidth: 140, minHeight: 52 }
      : tool === "sticky_note"
        ? { width: 220, height: 180, minWidth: 180, minHeight: 140 }
        : { width: 168, height: 112, minWidth: 72, minHeight: 72 }

  if (rect.width < 8 || rect.height < 8) {
    return expandCanvasRect(start, defaults.width, defaults.height)
  }

  return {
    ...rect,
    width: Math.max(rect.width, defaults.minWidth),
    height: Math.max(rect.height, defaults.minHeight),
  }
}

function createCanvasObjectId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
}

function isPaneTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest(".react-flow__pane"))
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}
