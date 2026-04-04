import { useCallback, useState, type ReactNode } from "react"
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
  type OnConnect,
} from "@xyflow/react"
import { Eye, EyeOff } from "lucide-react"

import "@xyflow/react/dist/style.css"

import "@/components/canvas/flow-canvas/styles.css"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FlowCanvasProps = {
  className?: string
  overlay?: ReactNode
}

type FlowNodeData = {
  label: string
  kind: string
  note: string
}

const initialNodes: Node<FlowNodeData>[] = [
  {
    id: "brief",
    type: "canvas-node",
    position: { x: 40, y: 90 },
    data: {
      label: "Project brief",
      kind: "Input",
      note: "Scope, references, and constraints land here first.",
    },
  },
  {
    id: "canvas",
    type: "canvas-node",
    position: { x: 360, y: 40 },
    data: {
      label: "Canvas graph",
      kind: "Workspace",
      note: "Drag nodes, reconnect edges, and grow the editor surface.",
    },
  },
  {
    id: "review",
    type: "canvas-node",
    position: { x: 700, y: 180 },
    data: {
      label: "Review lane",
      kind: "Output",
      note: "A side rail for handoff states and validation checkpoints.",
    },
  },
]

const initialEdges: Edge[] = [
  {
    id: "brief-canvas",
    source: "brief",
    target: "canvas",
    animated: true,
  },
  {
    id: "canvas-review",
    source: "canvas",
    target: "review",
  },
]

const nodeTypes = {
  "canvas-node": CanvasNode,
}

export function FlowCanvas({ className, overlay }: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner className={className} overlay={overlay} />
    </ReactFlowProvider>
  )
}

function FlowCanvasInner({ className, overlay }: FlowCanvasProps) {
  const [nodes, , onNodesChange] = useNodesState<Node<FlowNodeData>>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isMiniMapVisible, setIsMiniMapVisible] = useState(true)

  const onConnect: OnConnect = useCallback(
    (connection) =>
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            animated: false,
          },
          currentEdges
        )
      ),
    [setEdges]
  )

  return (
    <section
      className={cn(
        "relative flex h-full w-full overflow-hidden border-l border-border/60 bg-background",
        className
      )}
      aria-label="Canvas flow workspace"
    >
      <div className="canvas-grid-backdrop" aria-hidden="true" />

      <div className="relative h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.5}
          maxZoom={1.6}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: {
              stroke: "var(--color-primary)",
              strokeOpacity: 0.55,
              strokeWidth: 1.5,
            },
          }}
          className="canvas-flow"
          proOptions={{ hideAttribution: true }}
        >
          <Panel position="bottom-left" className="canvas-panel">
            <div className="flex items-center gap-6 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>{nodes.length} nodes</span>
              <span>{edges.length} edges</span>
              <span>fit view enabled</span>
            </div>
          </Panel>

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
              aria-label={
                isMiniMapVisible ? "Hide minimap" : "Show minimap"
              }
              title={isMiniMapVisible ? "Hide minimap" : "Show minimap"}
            >
              {isMiniMapVisible ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </Panel>

          {isMiniMapVisible ? (
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
        </ReactFlow>
      </div>

      {overlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
          <div className="pointer-events-auto w-full">{overlay}</div>
        </div>
      ) : null}
    </section>
  )
}

function CanvasNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <article
      className={cn("canvas-node", selected && "canvas-node-selected")}
      aria-label={`${data.label} node`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="canvas-node-handle"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="canvas-node-kind">{data.kind}</p>
          <h3 className="mt-2 font-heading text-base font-semibold tracking-tight text-foreground">
            {data.label}
          </h3>
        </div>
        <span className="canvas-node-dot" aria-hidden="true" />
      </div>

      <p className="mt-3 max-w-56 text-sm leading-5 text-muted-foreground">
        {data.note}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="canvas-node-handle"
      />
    </article>
  )
}
