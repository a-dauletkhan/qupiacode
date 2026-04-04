import * as React from "react"

import { getVoiceApiBaseUrl } from "@/lib/api"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/modules/Canvas/components/ui/resizable"
import { Sidebar, SidebarContent } from "@/modules/Canvas/components/ui/sidebar"
// import { IntensityControl } from "@/modules/Agent/components/intensity-control"
import { Chat } from "@/modules/Chat/components/Chat"
import { VoiceCall } from "@/modules/VoiceCall/components/voice-call"
import { VoiceCallProvider } from "@/modules/VoiceCall/context/voice-call-context"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
<<<<<<< Updated upstream
  canvasId?: string
=======
  projectId: string
>>>>>>> Stashed changes
  userId?: string
  displayName?: string
}

export function AppSidebar({
<<<<<<< Updated upstream
  canvasId,
=======
  projectId,
>>>>>>> Stashed changes
  userId,
  displayName,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarContent className="overflow-hidden">
        <VoiceCallProvider
<<<<<<< Updated upstream
          apiBaseUrl={getVoiceApiBaseUrl()}
          canvasId={canvasId}
          userId={userId}
          displayName={displayName}
=======
          canvasId={projectId}
          userId={userId}
          displayName={displayName}
          apiBaseUrl={getVoiceApiBaseUrl()}
>>>>>>> Stashed changes
        >
          <ResizablePanelGroup
            orientation="vertical"
            className="min-h-0 flex-1"
          >
            <ResizablePanel defaultSize={35} minSize={"25%"}>
              <VoiceCall />
            </ResizablePanel>

            {/* <div className="flex items-center justify-between border-y border-border px-3 py-1.5">
              <span className="text-xs text-muted-foreground">AI Agent</span>
              <IntensityControl />
            </div> */}

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
