import * as React from "react"
import {
  ArrowDown,
  BotIcon,
  MicIcon,
  SendHorizonalIcon,
  UserIcon,
} from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import { Button } from "@/modules/Canvas/components/ui/button"
import { Input } from "@/modules/Canvas/components/ui/input"
import { cn } from "@/lib/utils"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
import { type VoiceCallChatMessageView } from "@/modules/VoiceCall/hooks/use-voice-call"

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
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const { chatMessages, errorMessage, inCall, roomName } = useVoiceCallContext()

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Live Chat</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {roomName || "No active call"}
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
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
                className="bg absolute right-4 bottom-4 z-10 rounded-full shadow-sm"
              >
                <ArrowDown className="size-4" />
              </Button>
            ) : null}
          </>
        ) : (
          <EmptyState inCall={inCall} errorMessage={errorMessage} />
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Input
          value=""
          readOnly
          disabled
          placeholder="Text input for the agent is disabled in this version."
          className="h-9"
        />
        <Button type="button" size="icon-lg" disabled aria-label="Send message">
          <SendHorizonalIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
