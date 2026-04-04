import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export function App() {
  return (
    <main className="h-svh w-full">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-full w-full bg-card"
      >
        <ResizablePanel defaultSize={68} minSize={'30%'}>
          {/* Canvas Component will be here */}
          <div className="flex h-full items-center justify-center">
            <p className="text-3xl font-semibold text-foreground">Content</p>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={32} minSize={'25%'}>
          <ResizablePanelGroup orientation="vertical" className="h-full">
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="flex h-full items-center justify-center">
                <p className="text-3xl font-semibold text-foreground">
                  Call Info
                </p>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={70} minSize={20}>
              <div className="flex h-full items-center justify-center">
                <p className="text-3xl font-semibold text-foreground">
                  Chat info
                </p>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}

export default App
