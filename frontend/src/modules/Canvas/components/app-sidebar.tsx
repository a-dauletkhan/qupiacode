import * as React from "react"

import { getVoiceApiBaseUrl } from "@/lib/api"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { Sidebar, SidebarContent } from "@/modules/Canvas/components/ui/sidebar"
import { Chat } from "@/modules/Chat/components/Chat"
import { VoiceCall } from "@/modules/VoiceCall/components/voice-call"
import { VoiceCallProvider } from "@/modules/VoiceCall/context/voice-call-context"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  projectId: string
  userId?: string
  displayName?: string
}

export function AppSidebar({
  projectId,
  userId,
  displayName,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarContent className="overflow-hidden">
        <VoiceCallProvider
          canvasId={projectId}
          userId={userId}
          displayName={displayName}
          apiBaseUrl={getVoiceApiBaseUrl()}
        >
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
