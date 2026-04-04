import * as React from "react"
import { useCreateThread, useThreads } from "@liveblocks/react/suspense"
import { Thread } from "@liveblocks/react-ui"
import { ArrowDown, Send } from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import "@liveblocks/react-ui/styles.css"
import "@liveblocks/react-ui/styles/dark/attributes.css"
import "@/modules/Chat/components/chat-liveblocks.css"

import { Button } from "@/modules/Canvas/components/ui/button"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"

function ChatMessageFooter() {
  return <div className="h-[88px]" />
}

const VIRTUOSO_COMPONENTS = {
  Footer: ChatMessageFooter,
}

function EmptyState({
  inCall,
  errorMessage,
}: {
  inCall: boolean
  errorMessage: string | null
}) {
  const title = inCall ? "No chat threads yet" : "Join a call to start"
  const body = inCall
    ? "Start a thread to share updates with everyone in the active room."
    : "This panel becomes the shared threaded chat feed for the active room."

  return (
    <div className="flex h-full items-center justify-center px-6 py-8 text-center">
      <div className="max-w-xs space-y-2">
        <p className="text-xs font-medium text-foreground/70">{title}</p>
        <p className="text-[11px] leading-5 text-muted-foreground/50">{body}</p>
        {errorMessage ? (
          <p className="text-[11px] leading-5 text-destructive/80">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

export function Chat() {
  const virtuosoRef = React.useRef<VirtuosoHandle>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const [input, setInput] = React.useState("")
  const { threads } = useThreads()
  const createThread = useCreateThread()
  const { errorMessage, inCall, roomName } = useVoiceCallContext()
  const aiAgent = useAiAgentOptional()
  const initialThreadIndex = Math.max(threads.length - 1, 0)

  function scrollToLatestThread() {
    if (threads.length === 0) {
      return
    }

    virtuosoRef.current?.scrollToIndex({
      index: threads.length - 1,
      align: "end",
      behavior: "smooth",
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const text = input.trim()
    if (!text) {
      return
    }

    // Detect @agent commands and route to AI agent service
    const agentMatch = text.match(/^@agent\s+(.+)/i)
    if (agentMatch && aiAgent) {
      console.info("[ai-agent] chat @agent command detected", {
        rawInput: text,
        extractedCommand: agentMatch[1],
        roomId: aiAgent.roomId,
        userId: aiAgent.userId,
      })
      aiAgent.sendCommand(agentMatch[1], { source: "chat" })
    }

    createThread({
      body: {
        version: 1,
        content: [{ type: "paragraph", children: [{ text }] }],
      },
      metadata: {},
    })

    setInput("")
    window.setTimeout(scrollToLatestThread, 100)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
        <div className="border-y border-white/[0.06] px-4 py-2">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/60 uppercase">
            Team Chat
          </p>
        </div>

        <div className="relative min-h-0">
          {threads.length > 0 ? (
            <>
              <Virtuoso
                ref={virtuosoRef}
                data={threads}
                atBottomStateChange={setIsAtBottom}
                followOutput={(atBottom) => (atBottom ? "smooth" : false)}
                initialTopMostItemIndex={initialThreadIndex}
                components={VIRTUOSO_COMPONENTS}
                itemContent={(_, thread) => (
                  <div className="px-2 py-1">
                    <Thread thread={thread} />
                  </div>
                )}
                style={{ height: "100%" }}
                increaseViewportBy={{ top: 200, bottom: 400 }}
              />

              {!isAtBottom ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={scrollToLatestThread}
                  aria-label="Scroll to latest message"
                  className="absolute right-4 bottom-4 z-10 rounded-full shadow-sm"
                >
                  <ArrowDown className="size-4" />
                </Button>
              ) : null}
            </>
          ) : (
            <EmptyState inCall={inCall} errorMessage={errorMessage} />
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1.5 border-t border-white/[0.06] p-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={aiAgent ? "Message or @agent..." : "Type a message..."}
          className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-lime-500/30 focus:outline-none focus:ring-1 focus:ring-lime-500/20"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-lime-500 px-2.5 py-1.5 text-xs font-medium text-black transition-opacity disabled:opacity-30"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  )
}
