import * as React from "react"
import { NodeResizer, type NodeProps } from "@xyflow/react"

import { useCanvasEditor } from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
import { NodeConnectionHandles } from "@/modules/Canvas/components/canvas/flow-canvas/node-connection-handles"
import { isTextNode, type TextNode } from "@/modules/Canvas/components/canvas/primitives/schema"
import { Textarea } from "@/modules/Canvas/components/ui/textarea"
import { cn } from "@/lib/utils"

export const TextNodeCard = React.memo(function TextNodeCard({
  id,
  data,
  isConnectable,
  selected,
}: NodeProps<TextNode>) {
  const { editingObjectId, finishEditing, updateCanvasObject } = useCanvasEditor()
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const isEditing = editingObjectId === id && !data.draft

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

  const textStyle = {
    color: data.style.color,
    fontSize: `${data.style.fontSize}px`,
    fontWeight: data.style.fontWeight,
    textAlign: data.style.align,
  } as React.CSSProperties

  return (
    <div
      className={cn(
        "canvas-text-node",
        selected && "canvas-text-node-selected",
        data.draft && "canvas-text-node-draft"
      )}
    >
      <NodeConnectionHandles
        nodeId={id}
        isConnectable={isConnectable}
        selected={selected}
        hidden={data.draft}
      />

      <NodeResizer
        color="oklch(0.768 0.233 130.85)"
        isVisible={selected && !data.draft}
        minWidth={280}
        minHeight={84}
        handleClassName="primitive-node-resize-handle"
        lineClassName="primitive-node-resize-line"
      />

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={data.content.text}
          placeholder="Type something"
          onChange={(event) =>
            updateCanvasObject(id, (node) =>
              isTextNode(node)
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      content: {
                        text: event.target.value,
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
          className="canvas-text-editor nodrag nopan nowheel"
          style={textStyle}
        />
      ) : (
        <div
          className={cn(
            "canvas-text-content",
            !data.content.text && "canvas-text-content-placeholder"
          )}
          style={textStyle}
        >
          {data.content.text || "Type something"}
        </div>
      )}
    </div>
  )
})
