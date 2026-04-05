import * as React from "react"
import { Image as ImageIcon, LoaderCircle } from "lucide-react"
import { NodeResizer, type NodeProps } from "@xyflow/react"

import { useCanvasEditor } from "@/modules/Canvas/components/canvas/flow-canvas/editor-context"
import { NodeConnectionHandles } from "@/modules/Canvas/components/canvas/flow-canvas/node-connection-handles"
import {
  isShapeNode,
  type PrimitivePaintStyle,
  type ShapeNode,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import {
  requestImageGeneration,
  requestImageGenerationStatus,
} from "@/modules/Canvas/services/image-generation-service"
import { Button } from "@/modules/Canvas/components/ui/button"
import { Textarea } from "@/modules/Canvas/components/ui/textarea"
import { cn } from "@/lib/utils"

const paintStyleBadges: Record<PrimitivePaintStyle, string> = {
  solid: "Solid",
  outline: "Outline",
  sketch: "Sketch",
  hatch: "Hatch",
}

const TERMINAL_IMAGE_STATUSES = new Set(["nsfw", "failed", "canceled"])
const IMAGE_POLL_INITIAL_DELAY_MS = 1000
const IMAGE_POLL_MAX_DELAY_MS = 15000
  
export const ShapeNodeCard = React.memo(function ShapeNodeCard({
  id,
  data,
  isConnectable,
  selected,
  width,
  height,
}: NodeProps<ShapeNode>) {
  const { editingObjectId, finishEditing, startEditing, updateCanvasObject } =
    useCanvasEditor()
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const updateCanvasObjectRef = React.useRef(updateCanvasObject)
  const pollTimeoutRef = React.useRef<number | null>(null)
  const pollDelayRef = React.useRef(IMAGE_POLL_INITIAL_DELAY_MS)
  const pollInFlightRef = React.useRef(false)
  const activePollRequestIdRef = React.useRef<string | null>(null)
  const [isSubmittingImageRequest, setIsSubmittingImageRequest] =
    React.useState(false)
  const isImagePlaceholder = data.sourceTool === "image"
  const isEditing = editingObjectId === id && !data.draft
  const dimensions = `${Math.round(width ?? 0)} × ${Math.round(height ?? 0)}`
  const promptText = data.content.label.trim()
  const imageUrl = data.content.imageUrl?.trim() || ""
  const requestId = data.content.requestId?.trim() || ""
  const generationStatus = data.content.generationStatus?.trim() || ""
  const generationError = data.content.generationError?.trim() || ""
  const isPollingImage =
    Boolean(requestId) && !imageUrl && !TERMINAL_IMAGE_STATUSES.has(generationStatus)

  React.useEffect(() => {
    updateCanvasObjectRef.current = updateCanvasObject
  }, [updateCanvasObject])

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

  React.useEffect(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current)
      pollTimeoutRef.current = null
    }

    if (!isImagePlaceholder || !requestId || imageUrl || !isPollingImage) {
      activePollRequestIdRef.current = null
      pollInFlightRef.current = false
      pollDelayRef.current = IMAGE_POLL_INITIAL_DELAY_MS
      return
    }

    if (activePollRequestIdRef.current === requestId) {
      return
    }

    activePollRequestIdRef.current = requestId
    pollDelayRef.current = IMAGE_POLL_INITIAL_DELAY_MS

    const scheduleNextPoll = () => {
      const delayMs = pollDelayRef.current
      pollTimeoutRef.current = window.setTimeout(() => {
        void pollImageStatus()
      }, delayMs)
      pollDelayRef.current = Math.min(delayMs * 2, IMAGE_POLL_MAX_DELAY_MS)
    }

    const pollImageStatus = async () => {
      if (pollInFlightRef.current) {
        return
      }

      pollInFlightRef.current = true

      try {
        const statusResponse = await requestImageGenerationStatus(requestId)
        if (activePollRequestIdRef.current !== requestId) {
          pollInFlightRef.current = false
          return
        }

        const nextImageUrl = statusResponse.images[0]?.url ?? ""
        const nextStatus = statusResponse.status
        const nextStatusUrl = statusResponse.status_url ?? undefined
        const nextCancelUrl = statusResponse.cancel_url ?? undefined
        const nextError =
          TERMINAL_IMAGE_STATUSES.has(nextStatus)
            ? `Generation ${nextStatus.replace("_", " ")}.`
            : undefined

        updateCanvasObjectRef.current(id, (node) => {
          if (!isShapeNode(node)) {
            return node
          }

          if (
            node.data.content.imageUrl === nextImageUrl &&
            node.data.content.generationStatus === nextStatus &&
            node.data.content.generationError === nextError &&
            node.data.content.statusUrl === nextStatusUrl &&
            node.data.content.cancelUrl === nextCancelUrl
          ) {
            return node
          }

          return {
            ...node,
            data: {
              ...node.data,
              content: {
                ...node.data.content,
                imageUrl: nextImageUrl || undefined,
                generationStatus: nextStatus,
                generationError: nextError,
                statusUrl: nextStatusUrl,
                cancelUrl: nextCancelUrl,
              },
            },
          }
        })

        if (!nextImageUrl && !TERMINAL_IMAGE_STATUSES.has(nextStatus)) {
          scheduleNextPoll()
        } else {
          activePollRequestIdRef.current = null
          pollDelayRef.current = IMAGE_POLL_INITIAL_DELAY_MS
        }
      } catch (error) {
        if (activePollRequestIdRef.current !== requestId) {
          pollInFlightRef.current = false
          return
        }

        updateCanvasObjectRef.current(id, (node) => {
          if (!isShapeNode(node)) {
            return node
          }

          const message =
            error instanceof Error
              ? error.message
              : "Image generation status request failed."

          if (
            node.data.content.generationStatus === "failed" &&
            node.data.content.generationError === message
          ) {
            return node
          }

          return {
            ...node,
            data: {
              ...node.data,
              content: {
                ...node.data.content,
                generationStatus: "failed",
                generationError: message,
              },
            },
          }
        })
        activePollRequestIdRef.current = null
        pollDelayRef.current = IMAGE_POLL_INITIAL_DELAY_MS
      } finally {
        pollInFlightRef.current = false
      }
    }

    scheduleNextPoll()

    return () => {
      if (activePollRequestIdRef.current === requestId) {
        activePollRequestIdRef.current = null
        pollInFlightRef.current = false
        pollDelayRef.current = IMAGE_POLL_INITIAL_DELAY_MS
      }
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current)
        pollTimeoutRef.current = null
      }
    }
  }, [id, imageUrl, isImagePlaceholder, isPollingImage, requestId])

  const handleGenerateImageClick = React.useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()

      if (!promptText) {
        updateCanvasObject(id, (node) =>
          isShapeNode(node)
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: {
                    ...node.data.content,
                    generationError: "Add a prompt before generating.",
                  },
                },
              }
            : node
        )
        startEditing(id)
        return
      }

      setIsSubmittingImageRequest(true)

      try {
        const response = await requestImageGeneration({
          nodeId: id,
          text: promptText,
          resolution: "16:9",
        })

        updateCanvasObject(id, (node) =>
          isShapeNode(node)
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: {
                    ...node.data.content,
                    requestId: response.request_id,
                    generationStatus: response.status,
                    generationError: undefined,
                    imageUrl: undefined,
                  },
                },
              }
            : node
        )
      } catch (error) {
        updateCanvasObject(id, (node) =>
          isShapeNode(node)
            ? {
                ...node,
                data: {
                  ...node.data,
                  content: {
                    ...node.data.content,
                    generationStatus: "failed",
                    generationError:
                      error instanceof Error
                        ? error.message
                        : "Image generation request failed.",
                  },
                },
              }
            : node
        )
      } finally {
        setIsSubmittingImageRequest(false)
      }
    },
    [id, promptText, startEditing, updateCanvasObject]
  )

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
          {isImagePlaceholder && !data.draft ? (
            <div className="primitive-image-content">
              {imageUrl ? (
                <div className="primitive-image-preview">
                  <img
                    src={imageUrl}
                    alt={promptText || "Generated image"}
                    className="primitive-image-preview-media nodrag nopan"
                    draggable={false}
                  />
                </div>
              ) : isPollingImage || isSubmittingImageRequest ? (
                <div className="primitive-image-loader" aria-live="polite">
                  <LoaderCircle className="size-6 animate-spin text-lime-400" />
                  <div className="primitive-image-status">
                    {generationStatus === "submitted"
                      ? "Starting generation..."
                      : "Generating image..."}
                  </div>
                </div>
              ) : isEditing ? (
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
                              ...node.data.content,
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

              {!imageUrl && !isPollingImage && !isSubmittingImageRequest ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="primitive-image-action nodrag nopan"
                  disabled={isSubmittingImageRequest}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                  }}
                  onClick={handleGenerateImageClick}
                >
                  <ImageIcon className="size-3.5" />
                  Generate image
                </Button>
              ) : null}

              {generationError ? (
                <div className="primitive-image-status primitive-image-status-error">
                  {generationError}
                </div>
              ) : null}
            </div>
          ) : isEditing ? (
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
                          ...node.data.content,
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
              : `${isImagePlaceholder ? "Image" : data.content.label} · ${paintStyleBadges[data.style.paintStyle]}`}
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
