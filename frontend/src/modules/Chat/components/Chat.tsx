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

import { Button } from "@/modules/Canvas/components/ui/button"
import { cn } from "@/lib/utils"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
import { type VoiceCallChatMessageView } from "@/modules/VoiceCall/hooks/use-voice-call"
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"

type MessageType = VoiceCallChatMessageView["type"]

const MESSAGE_STYLES: Record<MessageType, string> = {
  user: "ml-auto border-border bg-muted text-foreground",
  person: "mr-auto bg-lime2 text-foreground",
  agent: "mr-auto border-lime-500/20 bg-lime-500/10 text-foreground",
}

const BADGE_STYLES: Record<MessageType, string> = {
  user: "text-muted-foreground",
  person: "text-muted-foreground",
  agent: "text-lime-600 dark:text-lime-400",
}

const MESSAGE_LABELS: Record<MessageType, string> = {
  user: "You",
  person: "Voice",
  agent: "Agent",
}

const AVATAR_STYLES: Record<MessageType, string> = {
  user: "border-border bg-muted text-muted-foreground",
  person: "border-border bg-background",
  agent: "border-lime-500/20 bg-lime-500/10 text-lime-600 dark:text-lime-400",
}

function MessageAvatar({ type }: { type: MessageType }) {
  const Icon =
    type === "agent" ? BotIcon : type === "person" ? MicIcon : UserIcon

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-sm border text-muted-foreground",
        AVATAR_STYLES[type]
      )}
    >
      <Icon className="size-4" />
    </div>
  )
}

function ChatMessageRow({ message }: { message: VoiceCallChatMessageView }) {
  const isUserMessage = message.type === "user"

  return (
    <div className="px-4 py-2">
      <div
        className={cn(
          "flex items-start gap-2",
          isUserMessage && "flex-row-reverse"
        )}
      >
        <MessageAvatar type={message.type} />

        <div
          className={cn(
            "max-w-[78%] rounded-sm border px-3 py-2",
            MESSAGE_STYLES[message.type]
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold">{message.author}</p>
            <span
              className={cn(
                "text-[10px] tracking-[0.12em] uppercase",
                BADGE_STYLES[message.type]
              )}
            >
              {MESSAGE_LABELS[message.type]} · {message.time}
            </span>
          </div>

          <p className="text-xs leading-5">
            {message.text}
            {message.pending ? (
              <span className="ml-1 text-muted-foreground">...</span>
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
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{body}</p>
        {errorMessage ? (
          <p className="text-xs leading-5 text-destructive">{errorMessage}</p>
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

  const initialMessageIndex = Math.max(chatMessages.length - 1, 0)

  function scrollToLatestMessage() {
    if (chatMessages.length === 0) {
      return
    }

    virtuosoRef.current?.scrollToIndex({
      index: chatMessages.length - 1,
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Chat</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {roomName || "No active call"}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.15fr)_auto_minmax(0,1fr)_auto]">
        <div className="relative min-h-0">
          {chatMessages.length > 0 ? (
            <>
              <Virtuoso
                ref={virtuosoRef}
                data={chatMessages}
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

        <div className="border-y border-border px-4 py-2">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={aiAgent ? "Type a message or @agent..." : "Type a message..."}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-lime-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-md bg-lime-500 px-3 py-1.5 text-sm text-black disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}
