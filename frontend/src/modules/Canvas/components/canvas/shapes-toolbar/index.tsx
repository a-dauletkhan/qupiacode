import { useEffect, useId, useMemo, useState } from "react"
import { Lock, LockOpen, Settings2 } from "lucide-react"

import {
  PAINT_STYLE_OPTIONS,
  TOOL_CONFIGS,
  clampFontSize,
  clampStrokeWidth,
  isCanvasCreationTool,
  isShapeTool,
  type CanvasEditorDefaults,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import "@/modules/Canvas/components/canvas/shapes-toolbar/styles.css"
import { Button } from "@/modules/Canvas/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/Canvas/components/ui/dropdown-menu"
import { Slider } from "@/modules/Canvas/components/ui/slider"
import { cn } from "@/lib/utils"

type ShapesToolbarProps = {
  className?: string
  activeTool: ToolId
  toolLocked: boolean
  editorDefaults: CanvasEditorDefaults
  onActiveToolChange: (tool: ToolId) => void
  onToolLockedChange: (locked: boolean) => void
  onEditorDefaultsChange: (
    updater: (defaults: CanvasEditorDefaults) => CanvasEditorDefaults
  ) => void
}

export function ShapesToolbar({
  className,
  activeTool,
  toolLocked,
  editorDefaults,
  onActiveToolChange,
  onToolLockedChange,
  onEditorDefaultsChange,
}: ShapesToolbarProps) {
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={toolLocked}
            aria-label="Keep selected tool active after drawing"
            title="Keep selected tool active after drawing"
            className={cn(
              "shape-tool size-10 rounded-xl border border-transparent p-0 text-foreground/80",
              toolLocked && "shape-tool-active"
            )}
            onClick={() => onToolLockedChange(!toolLocked)}
            onPointerDown={dismissHint}
          >
            {renderIcon(toolLocked ? Lock : LockOpen)}
          </Button>

          <div className="shape-divider" aria-hidden="true" />

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
                  "shape-tool relative size-10 rounded-xl border border-transparent p-0 text-foreground/80",
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Default object settings"
                title="Default object settings"
                className="shape-tool size-10 rounded-xl border border-transparent p-0 text-foreground/80"
                onPointerDown={dismissHint}
              >
                {renderIcon(Settings2)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="shape-style-menu w-72 border border-border/70 bg-card/95 p-0 shadow-none"
              align="center"
            >
              <ToolbarDefaultsPanel
                activeTool={activeTool}
                editorDefaults={editorDefaults}
                onEditorDefaultsChange={onEditorDefaultsChange}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  )
}

function ToolbarDefaultsPanel({
  activeTool,
  editorDefaults,
  onEditorDefaultsChange,
}: Pick<ShapesToolbarProps, "activeTool" | "editorDefaults" | "onEditorDefaultsChange">) {
  if (isShapeTool(activeTool)) {
    return (
      <div className="space-y-3 p-3">
        <div>
          <DropdownMenuLabel className="px-0 py-0 text-[11px] uppercase tracking-[0.18em] text-primary">
            Shape Paint
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={editorDefaults.shape.paintStyle}
            onValueChange={(value) =>
              onEditorDefaultsChange((currentDefaults) => ({
                ...currentDefaults,
                shape: {
                  ...currentDefaults.shape,
                  paintStyle: value as typeof currentDefaults.shape.paintStyle,
                },
              }))
            }
          >
            {PAINT_STYLE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                className="mt-2 items-start rounded-none border border-transparent px-0 py-0 data-[state=checked]:border-primary/25"
              >
                <div className="pr-7">
                  <p className="text-xs font-medium text-foreground">
                    {option.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>

        <DropdownMenuSeparator />

        <div>
          <DropdownMenuLabel className="px-0 py-0 text-[11px] uppercase tracking-[0.18em] text-primary">
            Shape Stroke
          </DropdownMenuLabel>
          <div className="mt-3 flex items-center gap-3">
            <Slider
              min={1}
              max={8}
              step={1}
              value={[editorDefaults.shape.strokeWidth]}
              onValueChange={(values) =>
                onEditorDefaultsChange((currentDefaults) => ({
                  ...currentDefaults,
                  shape: {
                    ...currentDefaults.shape,
                    strokeWidth: clampStrokeWidth(
                      values[0] ?? currentDefaults.shape.strokeWidth
                    ),
                  },
                }))
              }
            />
            <span className="w-8 text-right text-xs font-medium text-foreground">
              {editorDefaults.shape.strokeWidth}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (activeTool === "text") {
    return (
      <div className="space-y-3 p-3">
        <DropdownMenuLabel className="px-0 py-0 text-[11px] uppercase tracking-[0.18em] text-primary">
          Text Defaults
        </DropdownMenuLabel>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Font Size
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Slider
              min={12}
              max={72}
              step={1}
              value={[editorDefaults.text.fontSize]}
              onValueChange={(values) =>
                onEditorDefaultsChange((currentDefaults) => ({
                  ...currentDefaults,
                  text: {
                    ...currentDefaults.text,
                    fontSize: clampFontSize(
                      values[0] ?? currentDefaults.text.fontSize
                    ),
                  },
                }))
              }
            />
            <span className="w-8 text-right text-xs font-medium text-foreground">
              {editorDefaults.text.fontSize}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (activeTool === "sticky_note") {
    return (
      <div className="space-y-3 p-3">
        <DropdownMenuLabel className="px-0 py-0 text-[11px] uppercase tracking-[0.18em] text-primary">
          Sticky Defaults
        </DropdownMenuLabel>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Font Size
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Slider
              min={12}
              max={48}
              step={1}
              value={[editorDefaults.stickyNote.fontSize]}
              onValueChange={(values) =>
                onEditorDefaultsChange((currentDefaults) => ({
                  ...currentDefaults,
                  stickyNote: {
                    ...currentDefaults.stickyNote,
                    fontSize: clampFontSize(
                      values[0] ?? currentDefaults.stickyNote.fontSize
                    ),
                  },
                }))
              }
            />
            <span className="w-8 text-right text-xs font-medium text-foreground">
              {editorDefaults.stickyNote.fontSize}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 text-[11px] leading-5 text-muted-foreground">
      Select a creation tool to adjust its default properties.
    </div>
  )
}

function renderIcon(Icon: (typeof TOOL_CONFIGS)[number]["icon"]) {
  return <Icon className="size-[18px] stroke-[1.7]" />
}
