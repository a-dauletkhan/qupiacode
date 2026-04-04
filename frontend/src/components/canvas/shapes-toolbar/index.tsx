import { useEffect, useId, useState } from "react"
import {
  ArrowRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  Pencil,
  Shapes,
  Square,
  Type,
} from "lucide-react"

import "@/components/canvas/shapes-toolbar/styles.css"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ToolId =
  | "hand"
  | "selection"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "draw"
  | "text"
  | "image"
  | "eraser"

type ToolConfig = {
  id: ToolId
  label: string
  shortcut: string
  icon: typeof Hand
  fillable?: boolean
}

type ShapesToolbarProps = {
  className?: string
}

const TOOL_HINT =
  "Click to start multiple points, drag for single line"

const primaryTools: ToolConfig[] = [
  { id: "hand", label: "Hand", shortcut: "H", icon: Hand },
  {
    id: "selection",
    label: "Selection",
    shortcut: "1",
    icon: MousePointer2,
    fillable: true,
  },
  {
    id: "rectangle",
    label: "Rectangle",
    shortcut: "2",
    icon: Square,
    fillable: true,
  },
  {
    id: "diamond",
    label: "Diamond",
    shortcut: "3",
    icon: Diamond,
    fillable: true,
  },
  {
    id: "ellipse",
    label: "Ellipse",
    shortcut: "4",
    icon: Circle,
    fillable: true,
  },
  {
    id: "arrow",
    label: "Arrow",
    shortcut: "5",
    icon: ArrowRight,
    fillable: true,
  },
  { id: "line", label: "Line", shortcut: "6", icon: Minus, fillable: true },
  { id: "draw", label: "Draw", shortcut: "7", icon: Pencil },
  { id: "text", label: "Text", shortcut: "8", icon: Type },
  { id: "image", label: "Insert image", shortcut: "9", icon: ImageIcon },
  { id: "eraser", label: "Eraser", shortcut: "0", icon: Eraser },
] as const

export function ShapesToolbar({ className }: ShapesToolbarProps) {
  const [activeTool, setActiveTool] = useState<ToolId>("selection")
  const [toolLocked, setToolLocked] = useState(false)
  const [isHintVisible, setIsHintVisible] = useState(true)
  const headingId = useId()

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

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "relative flex w-full max-w-[46rem] justify-center px-4 pt-4 sm:px-6",
        className
      )}
    >
      <div className="shape-island">
        <div
          className={cn("shape-hint-viewer", !isHintVisible && "shape-hint-hidden")}
          aria-live="polite"
        >
          <span>{TOOL_HINT}</span>
        </div>

        <h2 id={headingId} className="sr-only">
          Shapes
        </h2>

        <div
          role="toolbar"
          aria-label="Shapes toolbar"
          className="flex flex-wrap items-center justify-center gap-1"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={toolLocked}
            aria-label="Keep selected tool active after drawing"
            title="Keep selected tool active after drawing — Q"
            className={cn(
              "shape-tool size-10 rounded-xl border border-transparent p-0 text-foreground/80",
              toolLocked && "shape-tool-active"
            )}
            onClick={() => setToolLocked((value) => !value)}
            onPointerDown={dismissHint}
          >
            {renderIcon(toolLocked ? Lock : LockOpen)}
          </Button>

          <div className="shape-divider" aria-hidden="true" />

          {primaryTools.map((tool) => {
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
                  "shape-tool relative size-10 rounded-xl border border-transparent p-0 text-foreground/80",
                  isActive && "shape-tool-active",
                  tool.fillable && "shape-tool-fillable"
                )}
                onClick={() => {
                  setActiveTool(tool.id)
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
            aria-label="More tools"
            title="More tools"
            className="shape-tool size-10 rounded-xl border border-transparent p-0 text-foreground/80"
            onPointerDown={dismissHint}
          >
            {renderIcon(Shapes)}
          </Button>
        </div>
      </div>
    </section>
  )
}

function renderIcon(Icon: typeof Hand) {
  return <Icon className="size-[18px] stroke-[1.7]" />
}
