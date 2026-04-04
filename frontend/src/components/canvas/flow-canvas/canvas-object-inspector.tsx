import { SlidersHorizontal, X } from "lucide-react"
import type { CSSProperties } from "react"

import {
  applyObjectProperty,
  getObjectPropertySchema,
  type EditableProperty,
} from "@/components/canvas/primitives/inspector-schema"
import type { CanvasObjectNode } from "@/components/canvas/primitives/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type CanvasObjectInspectorProps = {
  anchor: {
    left: number
    top: number
  }
  side: "left" | "right"
  object: CanvasObjectNode
  onClose: () => void
  onUpdateCanvasObject: (
    id: string,
    updater: (node: CanvasObjectNode) => CanvasObjectNode
  ) => void
}

export function CanvasObjectInspector({
  anchor,
  side,
  object,
  onClose,
  onUpdateCanvasObject,
}: CanvasObjectInspectorProps) {
  const schema = getObjectPropertySchema(object)

  return (
    <div
      className={cn(
        "canvas-inspector-anchor",
        side === "left"
          ? "canvas-inspector-anchor-left"
          : "canvas-inspector-anchor-right"
      )}
      style={{
        left: anchor.left,
        top: anchor.top,
      }}
    >
      <section className="canvas-inspector-menu">
        <div className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                {schema.title} Properties
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="rounded-lg"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {object.id}
          </p>

          {schema.properties.map((property) => (
            <div key={property.key} className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {property.label}
              </p>
              {renderPropertyControl(property, (value) =>
                onUpdateCanvasObject(object.id, (currentNode) =>
                  applyObjectProperty(currentNode, property.key, value)
                )
              )}
            </div>
          ))}

          <Button
            type="button"
            size="sm"
            className="canvas-inspector-ok-button"
            onClick={onClose}
          >
            OK
          </Button>
        </div>
      </section>
    </div>
  )
}

function renderPropertyControl(
  property: EditableProperty,
  onChange: (value: string | number) => void
) {
  switch (property.controlType) {
    case "color":
      return (
        <div className="grid grid-cols-4 gap-2">
          {property.options.map((option) => {
            const isActive = option.value === property.value

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "canvas-inspector-color-swatch",
                  isActive && "canvas-inspector-color-swatch-active"
                )}
                style={{ "--swatch-color": option.value } as CSSProperties}
                onClick={() => onChange(option.value)}
                aria-label={option.label}
                title={option.label}
              />
            )
          })}
        </div>
      )
    case "segmented":
      return (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(4rem,1fr))]">
          {property.options.map((option) => {
            const isActive = option.value === property.value

            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "canvas-inspector-segment",
                  isActive && "canvas-inspector-segment-active"
                )}
                onClick={() => onChange(option.value)}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
      )
    case "slider":
      return (
        <div className="flex items-center gap-3">
          <Slider
            min={property.min}
            max={property.max}
            step={property.step}
            value={[property.value]}
            onValueChange={(values) => onChange(values[0] ?? property.value)}
          />
          <Input
            value={String(property.value)}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-8 w-16 border-white/10 bg-white/[0.04] text-right text-xs shadow-none"
          />
        </div>
      )
    case "textarea":
      return (
        <Textarea
          value={property.value}
          placeholder={property.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24 resize-none border-white/10 bg-white/[0.04] text-sm leading-5 shadow-none"
        />
      )
  }
}
