import * as React from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Sidebar, SidebarContent } from "@/components/ui/sidebar"
import { VoiceCall } from "@/modules/VoiceCall/components/voice-call"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarContent className="overflow-hidden">
        <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={35} minSize={'25%'}>
            <VoiceCall />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={65} minSize={20}>
            <div className="flex h-full items-center justify-center">
              <p className="text-lg font-semibold text-foreground">
                Bottom Panel
              </p>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarContent>
    </Sidebar>
  )
}
