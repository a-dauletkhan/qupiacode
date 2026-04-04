import * as React from "react"

import { getVoiceApiBaseUrl } from "@/lib/api"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { Sidebar, SidebarContent } from "@/modules/Canvas/components/ui/sidebar"
import { IntensityControl } from "@/modules/Agent/components/intensity-control"
import { Chat } from "@/modules/Chat/components/Chat"
import { VoiceCall } from "@/modules/VoiceCall/components/voice-call"
import { VoiceCallProvider } from "@/modules/VoiceCall/context/voice-call-context"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarContent className="overflow-hidden">
        <VoiceCallProvider apiBaseUrl={getVoiceApiBaseUrl()}>
          <ResizablePanelGroup
            orientation="vertical"
            className="min-h-0 flex-1"
          >
            <ResizablePanel defaultSize={35} minSize={"25%"}>
              <VoiceCall />
            </ResizablePanel>

            <div className="flex items-center justify-between border-y border-border px-3 py-1.5">
              <span className="text-xs text-muted-foreground">AI Agent</span>
              <IntensityControl />
            </div>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={65} minSize={20}>
              <Chat />
            </ResizablePanel>
          </ResizablePanelGroup>
        </VoiceCallProvider>
      </SidebarContent>
    </Sidebar>
  )
}
