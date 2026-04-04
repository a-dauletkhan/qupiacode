import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronDown,
  Link2,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Share2,
} from "lucide-react"
import { usePanelRef } from "react-resizable-panels"

import { AppSidebar } from "@/modules/Canvas/components/app-sidebar"
import { FlowCanvas } from "@/modules/Canvas/components/canvas/flow-canvas"
import {
  DEFAULT_EDITOR_DEFAULTS,
  TOOL_CONFIGS,
  type CanvasEditorDefaults,
  type ToolId,
} from "@/modules/Canvas/components/canvas/primitives/schema"
import { Room } from "@/modules/Canvas/components/canvas/room"
import { ShapesToolbar } from "@/modules/Canvas/components/canvas/shapes-toolbar"
import { Button } from "@/modules/Canvas/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/Canvas/components/ui/dropdown-menu"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { SidebarProvider } from "@/modules/Canvas/components/ui/sidebar"
import { useProjects } from "@/lib/projects"

const DEFAULT_SIDEBAR_WIDTH = 420
const MIN_SIDEBAR_WIDTH = 360
const MAX_SIDEBAR_WIDTH = 720
const SELF_URL = import.meta.env.VITE_SELF_URL?.trim() || window.location.origin
const TOOL_SHORTCUTS = new Map(
  TOOL_CONFIGS.filter((tool) => tool.implemented).map((tool) => [
    tool.shortcut.toLowerCase(),
    tool.id,
  ])
)

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

export function CanvasWorkspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { getProject } = useProjects()
  const project = projectId ? getProject(projectId) : null
  const shareLink = React.useMemo(
    () => new URL(`/invite/${projectId ?? ""}`, SELF_URL).toString(),
    [projectId]
  )

  const sidebarPanelRef = usePanelRef()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true)
  const [lastSidebarSize, setLastSidebarSize] = React.useState(DEFAULT_SIDEBAR_WIDTH)
  const [activeTool, setActiveTool] = React.useState<ToolId>("selection")
  const [editorDefaults, setEditorDefaults] = React.useState<CanvasEditorDefaults>(
    DEFAULT_EDITOR_DEFAULTS
  )

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      const nextTool = TOOL_SHORTCUTS.get(event.key.toLowerCase())

      if (!nextTool) {
        return
      }

      event.preventDefault()
      setActiveTool(nextTool)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const toggleSidebar = React.useCallback(() => {
    if (!sidebarPanelRef.current) return

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
        Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, panelSize.inPixels))
      )
    },
    []
  )

  const copyShareLink = React.useCallback(() => {
    void navigator.clipboard.writeText(shareLink)
  }, [shareLink])

  if (!project) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">Project not found</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
          Back to projects
        </Button>
      </div>
    )
  }

  return (
    <Room id={project.id}>
      <SidebarProvider className="h-svh min-h-0 bg-background">
        <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
          <ResizablePanel defaultSize="70%" minSize="45%">
            <main className="relative flex h-full min-w-0 bg-background">
              <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border bg-card/80 text-foreground backdrop-blur hover:bg-accent"
                  onClick={toggleSidebar}
                  aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {isSidebarOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
                </Button>
              </div>

              <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-border bg-card/80 text-foreground backdrop-blur hover:bg-accent"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft className="size-4" />
                  <span className="max-w-[160px] truncate text-xs">{project.name}</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border bg-card/80 text-foreground backdrop-blur hover:bg-accent"
                    >
                      <Share2 className="size-4" />
                      Share
                      <ChevronDown className="size-3" data-icon="inline-end" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="min-w-44">
                    <DropdownMenuItem onSelect={copyShareLink}>
                      <Link2 className="size-4" />
                      Copy share link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <FlowCanvas
                activeTool={activeTool}
                editorDefaults={editorDefaults}
                onActiveToolChange={setActiveTool}
                overlay={
                  <ShapesToolbar
                    activeTool={activeTool}
                    editorDefaults={editorDefaults}
                    onActiveToolChange={setActiveTool}
                    onEditorDefaultsChange={(updater) =>
                      setEditorDefaults((currentDefaults) => updater(currentDefaults))
                    }
                  />
                }
              />
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
    </Room>
  )
}
