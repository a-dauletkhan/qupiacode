import * as React from "react"
import { Handle, Position, useConnection } from "@xyflow/react"

import { cn } from "@/lib/utils"

type NodeConnectionHandlesProps = {
  nodeId: string
  isConnectable: boolean
  selected: boolean
  hidden?: boolean
}

const HANDLE_DEFINITIONS = [
  {
    id: "top",
    type: "target" as const,
    position: Position.Top,
  },
  {
    id: "bottom",
    type: "source" as const,
    position: Position.Bottom,
  },
  {
    id: "right",
    type: "source" as const,
    position: Position.Right,
  },
  {
    id: "left",
    type: "target" as const,
    position: Position.Left,
  },
] as const

export const NodeConnectionHandles = React.memo(
  function NodeConnectionHandles({
    nodeId,
    isConnectable,
    selected,
    hidden,
  }: NodeConnectionHandlesProps) {
    const connection = useConnection()
    const isConnectionTarget =
      connection.inProgress && connection.fromNode.id !== nodeId
    const isVisible = !hidden && (selected || isConnectionTarget)

    if (hidden) {
      return null
    }

    return (
      <>
        {HANDLE_DEFINITIONS.map(({ id, type, position }) => (
          <Handle
            key={id}
            id={id}
            type={type}
            position={position}
            isConnectable={isConnectable}
            className={cn(
              "canvas-node-handle",
              isVisible && "canvas-node-handle-visible"
            )}
          />
        ))}
      </>
    )
  }
)
