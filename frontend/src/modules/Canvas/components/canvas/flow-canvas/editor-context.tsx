import * as React from "react"

import type { CanvasObjectNode } from "@/modules/Canvas/components/canvas/primitives/schema"

type CanvasEditorContextValue = {
  editingObjectId: string | null
  startEditing: (id: string) => void
  finishEditing: () => void
  updateCanvasObject: (
    id: string,
    updater: (node: CanvasObjectNode) => CanvasObjectNode
  ) => void
}

const CanvasEditorContext =
  React.createContext<CanvasEditorContextValue | null>(null)

export function CanvasEditorProvider({
  children,
  value,
}: React.PropsWithChildren<{ value: CanvasEditorContextValue }>) {
  return (
    <CanvasEditorContext.Provider value={value}>
      {children}
    </CanvasEditorContext.Provider>
  )
}

export function useCanvasEditor() {
  const context = React.useContext(CanvasEditorContext)

  if (!context) {
    throw new Error("useCanvasEditor must be used inside CanvasEditorProvider")
  }

  return context
}
