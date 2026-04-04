import * as React from "react"
import { Handle, Position, useConnection } from "@xyflow/react"

import { cn } from "@/lib/utils"

type NodeConnectionHandlesProps = {
  nodeId: string
  isConnectable: boolean
  selected: boolean
  hidden?: boolean
}

const HANDLE_POSITIONS = [
  Position.Top,
  Position.Right,
  Position.Bottom,
  Position.Left,
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
        {HANDLE_POSITIONS.map((position) => (
          <Handle
            key={position}
            id={`${position}-handle`}
            type="source"
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
