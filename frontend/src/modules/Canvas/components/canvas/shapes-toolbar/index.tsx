import { useEffect, useId, useMemo, useState } from "react"
import { Redo2, Undo2 } from "lucide-react"
import {
  useCanRedo,
  useCanUndo,
  useRedo,
  useUndo,
} from "@liveblocks/react/suspense"

import {
  TOOL_CONFIGS,
  isCanvasCreationTool,
  isShapeTool,
  type CanvasEditorDefaults,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import "@/modules/Canvas/components/canvas/shapes-toolbar/styles.css"
import { Button } from "@/modules/Canvas/components/ui/button"
import { cn } from "@/lib/utils"

type ShapesToolbarProps = {
  className?: string
  activeTool: ToolId
  editorDefaults: CanvasEditorDefaults
  onActiveToolChange: (tool: ToolId) => void
  onEditorDefaultsChange: (
    updater: (defaults: CanvasEditorDefaults) => CanvasEditorDefaults
  ) => void
}

export function ShapesToolbar(props: ShapesToolbarProps) {
  const { className, activeTool, onActiveToolChange } = props
  const [isHintVisible, setIsHintVisible] = useState(true)
  const headingId = useId()
  const undo = useUndo()
  const redo = useRedo()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  const dismissHint = () => {
    setIsHintVisible(false)
  }

  useEffect(() => {
    if (!isHintVisible) {
      return
    }

    const handlePointerDown = () => {
      setIsHintVisible(false)
    }

    window.addEventListener("pointerdown", handlePointerDown, true)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [isHintVisible])

  const hint = useMemo(() => {
    if (activeTool === "selection") {
      return "Select one object to move, resize, or edit its properties"
    }

    if (activeTool === "hand") {
      return "Drag on the canvas to pan the workspace"
    }

    if (activeTool === "text") {
      return "Drag to preview a text box, then type inline after release"
    }

    if (activeTool === "sticky_note") {
      return "Drag to preview a sticky note, then type directly into it"
    }

    if (isShapeTool(activeTool)) {
      return "Drag on the canvas to preview and place a shape"
    }

    if (isCanvasCreationTool(activeTool)) {
      return "Drag on the canvas to preview and place a new object"
    }

    return "Shape, text, and sticky-note creation are active in this canvas"
  }, [activeTool])

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative mx-auto flex w-full max-w-[62rem] justify-center px-4 pt-4 sm:px-6",
        className
      )}
    >
      <div className="shape-island">
        <div
          className={cn("shape-hint-viewer", !isHintVisible && "shape-hint-hidden")}
          aria-live="polite"
        >
          <span>{hint}</span>
        </div>

        <h2 id={headingId} className="sr-only">
          Canvas objects
        </h2>

        <div
          role="toolbar"
          aria-label="Canvas object toolbar"
          className="flex flex-wrap items-center justify-center gap-1"
        >
          {TOOL_CONFIGS.map((tool) => {
            const isActive = activeTool === tool.id

            return (
              <Button
                key={tool.id}
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={isActive}
                aria-label={tool.label}
                title={`${tool.label} — ${tool.shortcut}`}
                className={cn(
                  "shape-tool relative size-8 rounded-xl border border-transparent p-0 text-foreground/80",
                  isActive && "shape-tool-active",
                  tool.fillable && "shape-tool-fillable",
                  !tool.implemented && "shape-tool-disabled"
                )}
                disabled={!tool.implemented}
                onClick={() => {
                  onActiveToolChange(tool.id)
                  dismissHint()
                }}
                onPointerDown={dismissHint}
              >
                {renderIcon(tool.icon)}
                <span className="shape-keybinding">{tool.shortcut}</span>
              </Button>
            )
          })}

          <div className="shape-divider" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Undo canvas change"
            title="Undo (Ctrl/Cmd+Z)"
            className="shape-tool size-8 rounded-xl border border-transparent p-0 text-foreground/80"
            disabled={!canUndo}
            onClick={undo}
            onPointerDown={dismissHint}
          >
            <Undo2 className="size-[18px] stroke-[1.7]" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Redo canvas change"
            title="Redo (Ctrl/Cmd+Shift+Z)"
            className="shape-tool size-8 rounded-xl border border-transparent p-0 text-foreground/80"
            disabled={!canRedo}
            onClick={redo}
            onPointerDown={dismissHint}
          >
            <Redo2 className="size-[18px] stroke-[1.7]" />
          </Button>
        </div>
      </div>
    </section>
  )
}

function renderIcon(Icon: (typeof TOOL_CONFIGS)[number]["icon"]) {
  return <Icon className="size-[18px] stroke-[1.7]" />
}
