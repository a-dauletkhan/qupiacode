import * as React from "react"
import { NodeResizer, type NodeProps } from "@xyflow/react"

import { useCanvasEditor } from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
import { NodeConnectionHandles } from "@/modules/Canvas/components/canvas/flow-canvas/node-connection-handles"
import {
  isStickyNoteNode,
  type StickyNoteNode,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import { Textarea } from "@/modules/Canvas/components/ui/textarea"
import { cn } from "@/lib/utils"

export const StickyNoteNodeCard = React.memo(function StickyNoteNodeCard({
  id,
  data,
  isConnectable,
  selected,
}: NodeProps<StickyNoteNode>) {
  const { editingObjectId, finishEditing, updateCanvasObject } =
    useCanvasEditor()
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

  const noteStyle = {
    "--sticky-note-color": data.style.color,
    "--sticky-note-text-color": data.style.textColor,
    "--sticky-note-font-size": `${data.style.fontSize}px`,
  } as React.CSSProperties

  return (
    <div
      className={cn(
        "canvas-sticky-node",
        selected && "canvas-sticky-node-selected",
        data.draft && "canvas-sticky-node-draft"
      )}
      style={noteStyle}
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
        minWidth={180}
        minHeight={140}
        handleClassName="primitive-node-resize-handle"
        lineClassName="primitive-node-resize-line"
      />

      <div className="canvas-sticky-edge" aria-hidden="true" />

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={data.content.text}
          placeholder="Add note"
          onChange={(event) =>
            updateCanvasObject(id, (node) =>
              isStickyNoteNode(node)
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
          className="canvas-sticky-editor nodrag nopan nowheel"
        />
      ) : (
        <div
          className={cn(
            "canvas-sticky-content",
            !data.content.text && "canvas-sticky-content-placeholder"
          )}
        >
          {data.content.text || "Add note"}
        </div>
      )}
    </div>
  )
})
