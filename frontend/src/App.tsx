import { AppSidebar } from "@/components/app-sidebar"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"

export function App() {
  return (
    <SidebarProvider className="h-svh min-h-0 bg-card">
      <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={75} minSize={70}>
          <main className="flex h-full min-w-0 items-center justify-center">
            {/* Canvas Component will be here */}
            <p className="text-3xl font-semibold text-foreground">Content</p>
          </main>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={'25%'} minSize={'20%'} maxSize={'30%'}>
          <AppSidebar side="right" collapsible="none" className="w-full" />
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}

export default App
