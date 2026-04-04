import * as React from "react"
import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react"
import { usePanelRef } from "react-resizable-panels"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"

export function App() {
  const sidebarPanelRef = usePanelRef()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)

  const toggleSidebar = React.useCallback(() => {
    if (sidebarPanelRef.current?.isCollapsed()) {
      sidebarPanelRef.current.expand()
      setIsSidebarOpen(true)
      return
    }

    sidebarPanelRef.current?.collapse()
    setIsSidebarOpen(false)
  }, [sidebarPanelRef])

  return (
    <SidebarProvider className="h-svh min-h-0 bg-card">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={75} minSize={70}>
          <main className="relative flex h-full min-w-0 items-center justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={toggleSidebar}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? (
                <PanelRightCloseIcon />
              ) : (
                <PanelRightOpenIcon />
              )}
            </Button>

            {/* Canvas Component will be here */}
            <p className="text-3xl font-semibold text-foreground">Content</p>
          </main>
        </ResizablePanel>

        {isSidebarOpen ? <ResizableHandle withHandle /> : null}

        <ResizablePanel
          collapsible
          collapsedSize={0}
          defaultSize="25%"
          maxSize="30%"
          minSize="20%"
          onResize={(panelSize) => setIsSidebarOpen(panelSize.asPercentage > 0)}
          panelRef={sidebarPanelRef}
        >
          <AppSidebar side="right" collapsible="none" className="w-full" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}

export default App
