import * as React from "react"
import {
  ArrowDown,
  BotIcon,
  Hand,
  SendHorizonalIcon,
  UserIcon,
} from "lucide-react"
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type MessageType = "user" | "person" | "agent"

type ChatMessage = {
  id: number
  type: MessageType
  author: string
  time: string
  text: string
}

const MESSAGE_TEMPLATES: Array<Omit<ChatMessage, "id" | "time">> = [
  {
    type: "person",
    author: "Jane Cooper",
    text: "Hey, I reviewed the voice-call notes and left a few questions about routing.",
  },
  {
    type: "user",
    author: "You",
    text: "Nice, send the critical ones here and I will go through them before the demo.",
  },
  {
    type: "agent",
    author: "Support Agent",
    text: "I can also summarize the open items and generate a short response draft if needed.",
  },
  {
    type: "person",
    author: "Jane Cooper",
    text: "Main concern is handoff timing. Are we buffering transcript updates before the agent reply?",
  },
  {
    type: "user",
    author: "You",
    text: "Yes, transcript chunks are grouped first so the bottom panel stays readable during the call.",
  },
  {
    type: "agent",
    author: "Support Agent",
    text: "Suggested follow-up: confirm the debounce interval and note expected UI latency under load.",
  },
]

const MOCK_MESSAGES: ChatMessage[] = Array.from({ length: 100 }, (_, index) => {
  const template = MESSAGE_TEMPLATES[index % MESSAGE_TEMPLATES.length]
  const totalMinutes = 9 * 60 + 41 + index
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`

  return {
    id: index + 1,
    type: template.type,
    author: template.author,
    text: template.text,
    time,
  }
})

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
  user: "User",
  person: "Person",
  agent: "Agent",
}

const AVATAR_STYLES: Record<MessageType, string> = {
  user: "border-border bg-muted text-muted-foreground",
  person: "border-border bg-background",
  agent: "border-lime-500/20 bg-lime-500/10 text-lime-600 dark:text-lime-400",
}

const INITIAL_MESSAGE_INDEX = Math.max(MOCK_MESSAGES.length - 1, 0)

function MessageAvatar({ type }: { type: MessageType }) {
  const isAgent = type === "agent"
  const Icon = isAgent ? BotIcon : UserIcon

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

function ChatMessageRow({ message }: { message: ChatMessage }) {
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

          <p className="text-xs leading-5">{message.text}</p>
        </div>
      </div>
    </div>
  )
}

function ChatMessageFooter() {
  return <div className="h-[184px]" />
}

const VIRTUOSO_COMPONENTS = {
  Footer: ChatMessageFooter,
}

export function Chat() {
  const virtuosoRef = React.useRef<VirtuosoHandle>(null)
  const suggestionAudioRef = React.useRef<HTMLAudioElement | null>(null)
  const suggestionAnimationFrameRef = React.useRef<number | null>(null)
  const [messages, setMessages] = React.useState<ChatMessage[]>(MOCK_MESSAGES)
  const [draft, setDraft] = React.useState("")
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const [isSuggestionVisible, setIsSuggestionVisible] = React.useState(false)

  React.useEffect(() => {
    suggestionAudioRef.current = new Audio("/audio/suggestion.mp3")
    suggestionAudioRef.current.volume = 0.25

    return () => {
      if (suggestionAnimationFrameRef.current !== null) {
        cancelAnimationFrame(suggestionAnimationFrameRef.current)
      }

      suggestionAudioRef.current?.pause()
      suggestionAudioRef.current = null
    }
  }, [])

  function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = draft.trim()

    if (!text) {
      return
    }

    const now = new Date()
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: now.getTime(),
        type: "user",
        author: "You",
        time,
        text,
      },
    ])
    setDraft("")
  }

  function scrollToLatestMessage() {
    if (messages.length === 0) {
      return
    }

    virtuosoRef.current?.scrollToIndex({
      index: messages.length - 1,
      align: "end",
      behavior: "smooth",
    })
  }

  function handleShowSuggestion() {
    if (suggestionAnimationFrameRef.current !== null) {
      cancelAnimationFrame(suggestionAnimationFrameRef.current)
    }

    const suggestionAudio = suggestionAudioRef.current
    if (suggestionAudio) {
      suggestionAudio.currentTime = 0
      void suggestionAudio.play()
    }

    setIsSuggestionVisible(false)
    suggestionAnimationFrameRef.current = requestAnimationFrame(() => {
      suggestionAnimationFrameRef.current = requestAnimationFrame(() => {
        setIsSuggestionVisible(true)
        suggestionAnimationFrameRef.current = null
      })
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Live Chat</p>
        <p className="text-xs text-muted-foreground">
          Conversation between user, person, and agent
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          atBottomStateChange={setIsAtBottom}
          followOutput={(atBottom) => (atBottom ? "smooth" : false)}
          initialTopMostItemIndex={INITIAL_MESSAGE_INDEX}
          components={VIRTUOSO_COMPONENTS}
          itemContent={(_, message) => <ChatMessageRow message={message} />}
          style={{ height: "100%" }}
          increaseViewportBy={{ top: 200, bottom: 400 }}
        />

        {!isAtBottom && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={scrollToLatestMessage}
            aria-label="Scroll to latest message"
            className="absolute right-4 bottom-4 z-10 rounded-full bg shadow-sm"
          >
            <ArrowDown className="size-4" />
          </Button>
        )}
      </div>

      <form
        onSubmit={handleSendMessage}
        className="relative flex items-center gap-2 border-t border-border p-3"
      >
        <Button
          type="button"
          className={cn(
            "absolute -top-[44px] left-3 rounded-full transition-all duration-300 ease-out",
            isSuggestionVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-4 opacity-0"
          )}
        >
          Jammy has got a suggestion
          <Hand />
        </Button>

        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message..."
          className="h-9"
        />
        <Button type="submit" size="icon-lg" aria-label="Send message">
          <SendHorizonalIcon className="size-4" />
        </Button>
        <Button type="button" onClick={handleShowSuggestion}>
          test
        </Button>
      </form>
    </div>
  )
}
