import * as React from "react"
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import { usePanelRef } from "react-resizable-panels"

import { AppSidebar } from "@/modules/Canvas/components/app-sidebar"
import { FlowCanvas } from "@/modules/Canvas/components/canvas/flow-canvas"
import {
  DEFAULT_EDITOR_DEFAULTS,
  type CanvasEditorDefaults,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import { Room } from "@/modules/Canvas/components/canvas/room"
import { ShapesToolbar } from "@/modules/Canvas/components/canvas/shapes-toolbar"
import { Button } from "@/modules/Canvas/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { SidebarProvider } from "@/modules/Canvas/components/ui/sidebar"

const DEFAULT_SIDEBAR_WIDTH = 420
const MIN_SIDEBAR_WIDTH = 360
const MAX_SIDEBAR_WIDTH = 720

export function App() {
  const sidebarPanelRef = usePanelRef()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)
  const [lastSidebarSize, setLastSidebarSize] = React.useState(DEFAULT_SIDEBAR_WIDTH)
  const [activeTool, setActiveTool] = React.useState<ToolId>("selection")
  const [toolLocked, setToolLocked] = React.useState(false)
  const [editorDefaults, setEditorDefaults] = React.useState<CanvasEditorDefaults>(
    DEFAULT_EDITOR_DEFAULTS
  )

  const toggleSidebar = React.useCallback(() => {
    if (!sidebarPanelRef.current) {
      return
    }

    if (isSidebarOpen) {
      sidebarPanelRef.current.collapse()
      setIsSidebarOpen(false)
      return
    }

    sidebarPanelRef.current.expand()
    sidebarPanelRef.current.resize(lastSidebarSize)
    setIsSidebarOpen(true)
  }, [isSidebarOpen, lastSidebarSize, sidebarPanelRef])

  const handleSidebarResize = React.useCallback(
    (panelSize: { asPercentage: number; inPixels: number }) => {
      if (panelSize.asPercentage <= 0) {
        setIsSidebarOpen(false)
        return
      }

      setIsSidebarOpen(true)
      setLastSidebarSize(
        Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, panelSize.inPixels)
        )
      )
    },
    []
  )

  return (
    <SidebarProvider className="h-svh min-h-0 bg-background">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize="70%" minSize="45%">
          <main className="relative flex h-full min-w-0 bg-background">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-[16px] size-[40px] right-4 z-30 border-border bg-card/80 text-foreground backdrop-blur hover:bg-accent"
              onClick={toggleSidebar}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? (
                <PanelRightCloseIcon />
              ) : (
                <PanelRightOpenIcon />
              )}
            </Button>

            <Room>
              <FlowCanvas
                activeTool={activeTool}
                toolLocked={toolLocked}
                editorDefaults={editorDefaults}
                onActiveToolChange={setActiveTool}
                overlay={
                  <ShapesToolbar
                    activeTool={activeTool}
                    toolLocked={toolLocked}
                    editorDefaults={editorDefaults}
                    onActiveToolChange={setActiveTool}
                    onToolLockedChange={setToolLocked}
                    onEditorDefaultsChange={(updater) =>
                      setEditorDefaults((currentDefaults) =>
                        updater(currentDefaults)
                      )
                    }
                  />
                }
              />
            </Room>
          </main>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          collapsible
          collapsedSize={0}
          defaultSize={`${DEFAULT_SIDEBAR_WIDTH}px`}
          maxSize={`${MAX_SIDEBAR_WIDTH}px`}
          minSize={`${MIN_SIDEBAR_WIDTH}px`}
          onResize={handleSidebarResize}
          panelRef={sidebarPanelRef}
        >
          <AppSidebar side="right" collapsible="none" className="w-full" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}

export default App
