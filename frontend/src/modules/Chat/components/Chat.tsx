import * as React from "react"
import { useCreateThread, useThreads } from "@liveblocks/react/suspense"
import { Thread } from "@liveblocks/react-ui"
import {
  ArrowDown,
  BotIcon,
  MicIcon,
  Send,
  UserIcon,
} from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import "@liveblocks/react-ui/styles.css"
import "@liveblocks/react-ui/styles/dark/attributes.css"
import "@/modules/Chat/components/chat-liveblocks.css"

import { Button } from "@/modules/Canvas/components/ui/button"
import { cn } from "@/lib/utils"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
import { type VoiceCallChatMessageView } from "@/modules/VoiceCall/hooks/use-voice-call"
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"
import { useAiChatMessages } from "@/modules/Agent/hooks/use-ai-chat-messages"

type MessageType = VoiceCallChatMessageView["type"]

const MESSAGE_STYLES: Record<MessageType, string> = {
  user: "ml-auto border-white/[0.06] bg-white/[0.04] text-foreground",
  person: "mr-auto border-white/[0.06] bg-white/[0.03] text-foreground",
  agent: "mr-auto border-lime-500/15 bg-lime-500/[0.06] text-foreground",
}

const BADGE_STYLES: Record<MessageType, string> = {
  user: "text-muted-foreground/70",
  person: "text-muted-foreground/70",
  agent: "text-lime-500/80",
}

const MESSAGE_LABELS: Record<MessageType, string> = {
  user: "You",
  person: "Voice",
  agent: "Agent",
}

const AVATAR_STYLES: Record<MessageType, string> = {
  user: "border-white/[0.08] bg-white/[0.05] text-muted-foreground",
  person: "border-white/[0.08] bg-white/[0.05] text-muted-foreground",
  agent: "border-lime-500/20 bg-lime-500/[0.08] text-lime-500",
}

function MessageAvatar({ type }: { type: MessageType }) {
  const Icon =
    type === "agent" ? BotIcon : type === "person" ? MicIcon : UserIcon

  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border",
        AVATAR_STYLES[type]
      )}
    >
      <Icon className="size-3.5" />
    </div>
  )
}

function ChatMessageRow({ message }: { message: VoiceCallChatMessageView }) {
  const isUserMessage = message.type === "user"

  return (
    <div className="px-3 py-1.5">
      <div
        className={cn(
          "flex items-start gap-2",
          isUserMessage && "flex-row-reverse"
        )}
      >
        <MessageAvatar type={message.type} />

        <div
          className={cn(
            "max-w-[80%] rounded-lg border px-3 py-2",
            MESSAGE_STYLES[message.type]
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium text-foreground/90">{message.author}</p>
            <span
              className={cn(
                "text-[9px] tabular-nums tracking-[0.1em] uppercase",
                BADGE_STYLES[message.type]
              )}
            >
              {MESSAGE_LABELS[message.type]} · {message.time}
            </span>
          </div>

          <p className="text-xs leading-[1.5] text-foreground/80">
            {message.text}
            {message.pending ? (
              <span className="ml-1 animate-pulse text-muted-foreground">...</span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}

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
  const title = inCall ? "Listening for transcript..." : "Join a call to start"
  const body = inCall
    ? "Transcripts and agent replies will appear here once speech is detected."
    : "This panel becomes the shared transcript and agent activity feed for the active room."

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
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const [input, setInput] = React.useState("")
  const { threads } = useThreads()
  const createThread = useCreateThread()
  const { chatMessages, errorMessage, inCall, roomName } = useVoiceCallContext()
  const aiAgent = useAiAgentOptional()
  const aiMessages = useAiChatMessages()

  // Merge voice transcript messages with AI agent messages
  const mergedMessages = React.useMemo(() => {
    if (aiMessages.length === 0) return chatMessages
    return [...chatMessages, ...aiMessages].sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }, [chatMessages, aiMessages])

  const initialMessageIndex = Math.max(mergedMessages.length - 1, 0)

  function scrollToLatestMessage() {
    if (mergedMessages.length === 0) {
      return
    }

    virtuosoRef.current?.scrollToIndex({
      index: mergedMessages.length - 1,
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
    window.setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-xs font-semibold tracking-wide uppercase text-foreground/80">Chat</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {roomName || "No active call"}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.15fr)_auto_minmax(0,1fr)_auto]">
        <div className="relative min-h-0">
          {mergedMessages.length > 0 ? (
            <>
              <Virtuoso
                ref={virtuosoRef}
                data={mergedMessages}
                atBottomStateChange={setIsAtBottom}
                followOutput={(atBottom) => (atBottom ? "smooth" : false)}
                initialTopMostItemIndex={initialMessageIndex}
                components={VIRTUOSO_COMPONENTS}
                itemContent={(_, message) => <ChatMessageRow message={message} />}
                style={{ height: "100%" }}
                increaseViewportBy={{ top: 200, bottom: 400 }}
              />

              {!isAtBottom ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={scrollToLatestMessage}
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

        <div className="border-y border-white/[0.06] px-4 py-2">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/60 uppercase">
            Team Chat
          </p>
        </div>

        <div className="min-h-0 overflow-y-auto px-2 py-2">
          {threads.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              Threaded messages will appear here after someone sends one.
            </div>
          ) : (
            threads.map((thread) => (
              <Thread key={thread.id} thread={thread} className="mb-2" />
            ))
          )}
          <div ref={bottomRef} />
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
