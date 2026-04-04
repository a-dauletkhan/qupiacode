import * as React from "react"
import { Cursors, useLiveblocksFlow } from "@liveblocks/react-flow"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
} from "@xyflow/react"
import { Eye, EyeOff } from "lucide-react"

import "@xyflow/react/dist/style.css"
import "@liveblocks/react-ui/styles.css"
import "@liveblocks/react-flow/styles.css"

import { CanvasObjectInspector } from "@/modules/Canvas/components/canvas/flow-canvas/canvas-object-inspector"
import {
  CanvasEditorProvider,
} from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
import { ShapeNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/primitive-node"
import { StickyNoteNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/sticky-note-node"
import { TextNodeCard } from "@/modules/Canvas/components/canvas/flow-canvas/text-node"
import { initialEdges, initialNodes } from "@/modules/Canvas/components/canvas/primitives/mock-data"
import {
  DRAFT_CANVAS_OBJECT_ID,
  createShapeNode,
  createStickyNoteNode,
  createTextNode,
  expandCanvasRect,
  getCanvasObjectSize,
  isCanvasCreationTool,
  isStickyNoteNode,
  isTextNode,
  normalizeCanvasRect,
  type CanvasCreationTool,
  type CanvasEditorDefaults,
  type CanvasObjectNode,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import "@/modules/Canvas/components/canvas/flow-canvas/styles.css"
import { Button } from "@/modules/Canvas/components/ui/button"
import { cn } from "@/lib/utils"

type FlowCanvasProps = {
  className?: string
  overlay?: React.ReactNode
  activeTool: ToolId
  toolLocked: boolean
  editorDefaults: CanvasEditorDefaults
  onActiveToolChange: (tool: ToolId) => void
}

type DraftCreation = {
  pointerId: number
  start: { x: number; y: number }
  tool: CanvasCreationTool
}

const nodeTypes = {
  shape: ShapeNodeCard,
  text: TextNodeCard,
  sticky_note: StickyNoteNodeCard,
}

const MINIMAP_ACTIVITY_HIDE_DELAY_MS = 1200

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
  toolLocked,
  editorDefaults,
  onActiveToolChange,
}: FlowCanvasProps) {
  const sectionRef = React.useRef<HTMLElement | null>(null)
  const hasMeasuredCanvasRef = React.useRef(false)
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
    nodes: {
      initial: initialNodes,
    },
    edges: {
      initial: initialEdges,
    },
  })
  const [isMiniMapVisible, setIsMiniMapVisible] = React.useState(true)
  const [draftCreation, setDraftCreation] = React.useState<DraftCreation | null>(
    null
  )
  const [draftNode, setDraftNode] = React.useState<CanvasObjectNode | null>(null)
  const [selectedObjectIds, setSelectedObjectIds] = React.useState<string[]>([])
  const [editingObjectId, setEditingObjectId] = React.useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = React.useState(false)
  const [inspectedObjectId, setInspectedObjectId] = React.useState<string | null>(
    null
  )
  const [isMiniMapActivityVisible, setIsMiniMapActivityVisible] =
    React.useState(false)
  const reactFlow = useReactFlow<CanvasObjectNode, Edge>()
  const viewport = useViewport()

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
    (
      id: string,
      updater: (node: CanvasObjectNode) => CanvasObjectNode
    ) => {
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

  const revealMiniMapActivity = React.useCallback(() => {
    if (miniMapActivityTimeoutRef.current) {
      window.clearTimeout(miniMapActivityTimeoutRef.current)
    }

    setIsMiniMapActivityVisible(true)
    miniMapActivityTimeoutRef.current = window.setTimeout(() => {
      setIsMiniMapActivityVisible(false)
      miniMapActivityTimeoutRef.current = null
    }, MINIMAP_ACTIVITY_HIDE_DELAY_MS)
  }, [])

  React.useEffect(
    () => () => {
      if (miniMapActivityTimeoutRef.current) {
        window.clearTimeout(miniMapActivityTimeoutRef.current)
      }
    },
    []
  )

  React.useEffect(() => {
    const canvasSection = sectionRef.current

    if (!canvasSection) {
      return
    }

    const canvasResizeObserver = new ResizeObserver(() => {
      if (!hasMeasuredCanvasRef.current) {
        hasMeasuredCanvasRef.current = true
        return
      }

      revealMiniMapActivity()
    })

    canvasResizeObserver.observe(canvasSection)

    return () => {
      canvasResizeObserver.disconnect()
    }
  }, [revealMiniMapActivity])

  const finishEditing = React.useCallback(() => {
    setEditingObjectId(null)
  }, [])

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
      }

      if (
        changes.some(
          (change) =>
            change.type === "remove" && change.id === editingObjectId
        )
      ) {
        finishEditing()
      }
    },
    [editingObjectId, finishEditing, onNodesChange]
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

      setSelectedObjectIds((currentIds) =>
        areStringArraysEqual(currentIds, nextIds) ? currentIds : nextIds
      )
    },
    [inspectedObjectId]
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
          ? clamp(rightScreenPosition.x - bounds.left + 12, 24, bounds.width - 24)
          : clamp(leftScreenPosition.x - bounds.left - 12, 24, bounds.width - 24),
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
      setInspectedObjectId(node.id)
      setInspectorOpen(true)
    },
    [finishEditing]
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

      const selectionChanges: NodeChange<CanvasObjectNode>[] = selectedObjectIds.map(
        (id) => ({
          id,
          selected: false,
          type: "select",
        })
      )

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

      if (isTextNode(createdNode) || isStickyNoteNode(createdNode)) {
        setEditingObjectId(createdNode.id)
      }

      if (!toolLocked) {
        onActiveToolChange("selection")
      }
    },
    [
      buildNodeFromTool,
      draftCreation,
      onActiveToolChange,
      onNodesChange,
      selectedObjectIds,
      toolLocked,
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
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDelete={onDelete}
            onPaneClick={() => {
              finishEditing()
              setInspectedObjectId(null)
              setInspectorOpen(false)
            }}
            onMoveStart={(event) => {
              if (event) {
                revealMiniMapActivity()
              }
            }}
            onMove={(event) => {
              if (event) {
                revealMiniMapActivity()
              }
            }}
            onNodeContextMenu={handleNodeContextMenu}
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
            elementsSelectable={activeTool === "selection" || Boolean(editingObjectId)}
            className={cn(
              "canvas-flow",
              isCanvasCreationTool(activeTool) && "canvas-flow-drawing",
              activeTool === "hand" && "canvas-flow-panning"
            )}
            proOptions={{ hideAttribution: true }}
          >
            <Panel position="bottom-left" className="canvas-panel">
              <div className="flex items-center gap-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span>{nodes.filter((node) => !node.data.draft).length} objects</span>
                <span>{activeTool}</span>
                <span>{selectedObjectIds.length} selected</span>
              </div>
            </Panel>

            {isMiniMapActivityVisible ? (
              <Panel
                position="bottom-right"
                className={cn(
                  "canvas-minimap-toggle-panel",
                  isMiniMapVisible && "canvas-minimap-toggle-panel-visible"
                )}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="canvas-minimap-toggle"
                  onClick={() => setIsMiniMapVisible((current) => !current)}
                  aria-label={isMiniMapVisible ? "Hide minimap" : "Show minimap"}
                  title={isMiniMapVisible ? "Hide minimap" : "Show minimap"}
                >
                  {isMiniMapVisible ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </Panel>
            ) : null}

            {isMiniMapVisible && isMiniMapActivityVisible ? (
              <MiniMap
                pannable
                zoomable
                className="canvas-minimap"
                bgColor="oklch(0.145 0 0)"
                nodeStrokeColor="oklch(0.768 0.233 130.85)"
                nodeColor="oklch(0.145 0 0)"
                nodeStrokeWidth={2}
                maskColor="color(srgb 0.0393766 0.039393 0.0393945 / 0.72)"
              />
            ) : null}

            <Controls className="canvas-controls" showInteractive={false} />
            <Background
              id="canvas-grid"
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.4}
              color="color-mix(in srgb, var(--color-border) 88%, transparent)"
            />
            <Cursors />
          </ReactFlow>
        </div>

        {inspectorOpen && inspectorAnchor && selectedObject && selectedObject.id === inspectedObjectId ? (
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
      </section>
    </CanvasEditorProvider>
  )
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
  return target instanceof HTMLElement && Boolean(target.closest(".react-flow__pane"))
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
