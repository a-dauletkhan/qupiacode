import * as React from "react"
import { NodeResizer, type NodeProps } from "@xyflow/react"

import { useCanvasEditor } from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
import { NodeConnectionHandles } from "@/modules/Canvas/components/canvas/flow-canvas/node-connection-handles"
import {
  isShapeNode,
  type PrimitivePaintStyle,
  type ShapeNode,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import { Textarea } from "@/modules/Canvas/components/ui/textarea"
import { cn } from "@/lib/utils"

const paintStyleBadges: Record<PrimitivePaintStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  sketch: "Sketch",
  hatch: "Hatch",
}

export const ShapeNodeCard = React.memo(function ShapeNodeCard({
  id,
  data,
  isConnectable,
  selected,
  width,
  height,
}: NodeProps<ShapeNode>) {
  const { editingObjectId, finishEditing, updateCanvasObject } =
    useCanvasEditor()
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const isEditing = editingObjectId === id && !data.draft
  const dimensions = `${Math.round(width ?? 0)} × ${Math.round(height ?? 0)}`

  React.useEffect(() => {
    if (!isEditing) {
      return
    }

    textareaRef.current?.focus()
    textareaRef.current?.setSelectionRange(
      textareaRef.current.value.length,
      textareaRef.current.value.length
    )
  }, [isEditing])

  return (
    <div className="primitive-node-shell">
      <NodeConnectionHandles
        nodeId={id}
        isConnectable={isConnectable}
        selected={selected}
        hidden={data.draft}
      />

      <NodeResizer
        color="oklch(0.768 0.233 130.85)"
        isVisible={selected && !data.draft}
        minWidth={72}
        minHeight={72}
        handleClassName="primitive-node-resize-handle"
        lineClassName="primitive-node-resize-line"
      />

      <div
        className={cn(
          "primitive-node-frame",
          data.draft && "primitive-node-frame-draft",
          selected && "primitive-node-frame-selected"
        )}
      >
        <div
          className={cn(
            "primitive-node-surface",
            `primitive-kind-${data.shapeKind}`,
            `primitive-paint-${data.style.paintStyle}`,
            data.draft && "primitive-node-surface-draft"
          )}
          style={getPrimitiveCssVars(data.style.color, data.style.strokeWidth)}
        >
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={data.content.label}
              placeholder="Type something"
              onChange={(event) =>
                updateCanvasObject(id, (node) =>
                  isShapeNode(node)
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          content: {
                            label: event.target.value,
                          },
                        },
                      }
                    : node
                )
              }
              onBlur={finishEditing}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.blur()
                }
              }}
              className="primitive-node-editor nodrag nopan nowheel"
            />
          ) : (
            <div
              className={cn(
                "primitive-node-content",
                !data.content.label && "primitive-node-content-placeholder"
              )}
            >
              {data.content.label || "Type something"}
            </div>
          )}
        </div>

        {(selected || data.draft) && (
          <div className="primitive-node-badge">
            {data.draft
              ? dimensions
              : `${data.content.label} · ${paintStyleBadges[data.style.paintStyle]}`}
          </div>
        )}
      </div>
    </div>
  )
})

function getPrimitiveCssVars(
  color: string,
  strokeWidth: number
): React.CSSProperties {
  return {
    "--primitive-color": color,
    "--primitive-fill": `color-mix(in srgb, ${color} 20%, transparent)`,
    "--primitive-fill-soft": `color-mix(in srgb, ${color} 12%, transparent)`,
    "--primitive-stroke-width": `${strokeWidth}px`,
  } as React.CSSProperties
}
