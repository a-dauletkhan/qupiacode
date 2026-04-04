import * as React from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { Sidebar, SidebarContent } from "@/modules/Canvas/components/ui/sidebar"
import { VoiceCall } from "@/modules/VoiceCall/components/voice-call"
import { VoiceCallProvider } from "@/modules/VoiceCall/context/voice-call-context"
import { Chat } from "@/modules/Chat/components/Chat"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarContent className="overflow-hidden">
        <VoiceCallProvider apiBaseUrl={import.meta.env.VITE_VOICE_API_BASE_URL}>
          <ResizablePanelGroup
            orientation="vertical"
            className="min-h-0 flex-1"
          >
            <ResizablePanel defaultSize={35} minSize={"25%"}>
              <VoiceCall />
            </ResizablePanel>

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
