import * as React from "react"
import type { CommentData } from "@liveblocks/core"
<<<<<<< Updated upstream
import { useCreateThread, useOthers, useSelf, useThreads } from "@liveblocks/react/suspense"
import { Comment } from "@liveblocks/react-ui"
import { ArrowDown, Send } from "lucide-react"
=======
import { useCreateThread, useSelf, useThreads } from "@liveblocks/react/suspense"
import { Comment } from "@liveblocks/react-ui"
import { ArrowDown, Bot, Megaphone, MessageSquareWarning, Palette, Send } from "lucide-react"
>>>>>>> Stashed changes
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso"

import "@liveblocks/react-ui/styles.css"
import "@liveblocks/react-ui/styles/dark/attributes.css"
import "@/modules/Chat/components/chat-liveblocks.css"

import { cn } from "@/lib/utils"
<<<<<<< Updated upstream
import { Button } from "@/modules/Canvas/components/ui/button"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"
import { SlashCommandMenu, useSlashCommands } from "@/modules/Chat/components/slash-command-menu"
import { Bot, Palette, MessageSquareWarning, Megaphone } from "lucide-react"
=======
import { useAiAgentOptional } from "@/modules/Agent/context/ai-agent-context"
import type { AiChatPersona, AiTargetPersona } from "@/modules/Agent/types"
import { Button } from "@/modules/Canvas/components/ui/button"
import { SlashCommandMenu, useSlashCommands } from "@/modules/Chat/components/slash-command-menu"
import { useVoiceCallContext } from "@/modules/VoiceCall/context/voice-call-context"
>>>>>>> Stashed changes

function ChatMessageFooter() {
  return <div className="h-[88px]" />
}

const VIRTUOSO_COMPONENTS = {
  Footer: ChatMessageFooter,
}

type ChatFeedMessage = {
  id: string
  comment: CommentData
  isOwnMessage: boolean
}

<<<<<<< Updated upstream
=======
const PERSONA_TYPING: Record<
  AiChatPersona,
  { icon: typeof Bot; label: string; cssColor: string }
> = {
  agent: { icon: Bot, label: "AI", cssColor: "oklch(0.768 0.233 130.85)" },
  designer: { icon: Palette, label: "Designer", cssColor: "oklch(0.72 0.16 240)" },
  critique: {
    icon: MessageSquareWarning,
    label: "Critique",
    cssColor: "oklch(0.72 0.19 28)",
  },
  marketing: {
    icon: Megaphone,
    label: "Marketing",
    cssColor: "oklch(0.86 0.18 95)",
  },
}

>>>>>>> Stashed changes
function getCommentTimestamp(value: Date | string | number) {
  return new Date(value).getTime()
}

function ChatFeedItem({
  comment,
  isOwnMessage,
}: {
  comment: CommentData
  isOwnMessage: boolean
}) {
  return (
    <div className="w-full px-2 py-1">
      <div
        className={cn(
          "chat-message w-fit max-w-[90%]",
          isOwnMessage
            ? "chat-message--self ml-auto"
            : "chat-message--other mr-auto",
        )}
      >
        <Comment
          comment={comment}
          className="max-w-full w-full"
          author={isOwnMessage ? "You" : undefined}
          showReactions={false}
        />
      </div>
    </div>
  )
}

function EmptyState({
  inCall,
  errorMessage,
}: {
  inCall: boolean
  errorMessage: string | null
}) {
  const title = inCall ? "No chat messages yet" : "Join a call to start"
  const body = inCall
    ? "Send a message to share updates with everyone in the active room."
    : "This panel becomes the shared room chat feed for the active room."

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

<<<<<<< Updated upstream
const PERSONA_TYPING: Record<string, { icon: typeof Bot; label: string; cssColor: string }> = {
  designer: { icon: Palette, label: "Designer", cssColor: "oklch(0.72 0.16 240)" },
  critique: { icon: MessageSquareWarning, label: "Critique", cssColor: "oklch(0.72 0.19 28)" },
  marketing: { icon: Megaphone, label: "Marketing", cssColor: "oklch(0.86 0.18 95)" },
}

function AiTypingIndicator() {
  const others = useOthers()
  const agent = others.find((o) => o.presence.type === "ai_agent")
  const isActing = agent?.presence.status === "acting"
  const persona = (agent?.presence as Record<string, unknown>)?.persona as string | undefined

  if (!isActing) return null

  const config = persona ? PERSONA_TYPING[persona] : undefined
  const Icon = config?.icon ?? Bot
  const label = config?.label ?? "AI"
  const color = config?.cssColor ?? "oklch(0.768 0.233 130.85)"
=======
function AiTypingIndicator({
  visible,
  persona,
}: {
  visible: boolean
  persona: AiChatPersona | null
}) {
  if (!visible) {
    return null
  }

  const resolvedPersona = persona ?? "agent"
  const config = PERSONA_TYPING[resolvedPersona]
  const Icon = config.icon
>>>>>>> Stashed changes

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div
        className="flex size-6 items-center justify-center rounded-md border"
<<<<<<< Updated upstream
        style={{ borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
=======
        style={{
          borderColor: `color-mix(in srgb, ${config.cssColor} 30%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${config.cssColor} 10%, transparent)`,
          color: config.cssColor,
        }}
>>>>>>> Stashed changes
      >
        <Icon className="size-3" />
      </div>
      <div className="flex items-center gap-1.5">
<<<<<<< Updated upstream
        <span className="text-[11px]" style={{ color: `color-mix(in srgb, ${color} 80%, transparent)` }}>
          {label} is typing
=======
        <span
          className="text-[11px]"
          style={{ color: `color-mix(in srgb, ${config.cssColor} 80%, transparent)` }}
        >
          {config.label} is thinking
>>>>>>> Stashed changes
        </span>
        <span className="flex gap-0.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="size-1 animate-bounce rounded-full"
<<<<<<< Updated upstream
              style={{ backgroundColor: `color-mix(in srgb, ${color} 60%, transparent)`, animationDelay: `${delay}ms` }}
=======
              style={{
                backgroundColor: `color-mix(in srgb, ${config.cssColor} 60%, transparent)`,
                animationDelay: `${delay}ms`,
              }}
>>>>>>> Stashed changes
            />
          ))}
        </span>
      </div>
    </div>
  )
}

export function Chat() {
  const virtuosoRef = React.useRef<VirtuosoHandle>(null)
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const [input, setInput] = React.useState("")
  const slash = useSlashCommands(input, setInput)
  const { threads } = useThreads()
  const currentUserId = useSelf((me) => me.id)
  const createThread = useCreateThread()
  const { errorMessage, inCall } = useVoiceCallContext()
  const aiAgent = useAiAgentOptional()
  const messages: ChatFeedMessage[] = threads
    .flatMap((thread) =>
      thread.comments.map((comment) => ({
        id: `${thread.id}:${comment.id}`,
        comment,
        isOwnMessage: comment.userId === currentUserId,
      })),
    )
    .sort((left, right) => {
      const timestampDifference =
        getCommentTimestamp(left.comment.createdAt) -
        getCommentTimestamp(right.comment.createdAt)

      if (timestampDifference !== 0) {
        return timestampDifference
      }

      return left.comment.id.localeCompare(right.comment.id)
    })
  const initialMessageIndex = Math.max(messages.length - 1, 0)

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const text = input.trim()
    if (!text) {
      return
    }

<<<<<<< Updated upstream
    // Detect @agent / @designer / @critique / @marketing commands
    const agentMatch = text.match(/^@(agent|designer|critique|marketing)\s+(.+)/i)
    if (agentMatch && aiAgent) {
      const persona = agentMatch[1].toLowerCase()
      const message = agentMatch[2]
      const targetPersona = persona === "agent" ? undefined : persona
      console.info("[ai-agent] chat command detected", {
        rawInput: text,
        persona: targetPersona ?? "auto",
        extractedCommand: message,
        roomId: aiAgent.roomId,
      })
      aiAgent.sendCommand(message, { source: "chat", targetPersona })
    }

    createThread({
=======
    const agentMatch = text.match(/^@(agent|designer|critique|marketing)\s+(.+)/i)
    const thread = createThread({
>>>>>>> Stashed changes
      body: {
        version: 1,
        content: [{ type: "paragraph", children: [{ text }] }],
      },
      metadata: {},
    })

    if (aiAgent) {
      aiAgent.pushEvent({
        type: agentMatch ? "chat.message.mentioned_ai" : "chat.message.created",
        data: {
          text,
          mentionedAi: Boolean(agentMatch),
          source: "liveblocks_thread",
          roomId: aiAgent.roomId,
          threadId: thread.id,
          targetPersona: agentMatch?.[1]?.toLowerCase() ?? null,
        },
      })
    }

    if (agentMatch && aiAgent) {
      const chatPersona = agentMatch[1].toLowerCase() as AiChatPersona
      const targetPersona: AiTargetPersona | null =
        chatPersona === "agent" ? null : chatPersona

      console.info("[ai-agent] chat command detected", {
        rawInput: text,
        persona: chatPersona,
        extractedCommand: agentMatch[2],
        roomId: aiAgent.roomId,
        userId: aiAgent.userId,
        threadId: thread.id,
      })

      void aiAgent.sendCommand(agentMatch[2], {
        source: "chat",
        threadId: thread.id,
        targetPersona,
        chatPersona,
      })
    }

    setInput("")
    window.setTimeout(scrollToLatestMessage, 0)
  }

  const typingVisible = Boolean(aiAgent && (aiAgent.commandPending || aiAgent.queue.currentCommand))

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
        <div className="border-y border-white/[0.06] px-4 py-2">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground/60 uppercase">
            Team Chat
          </p>
        </div>

        <div className="relative min-h-0">
          {messages.length > 0 ? (
            <>
              <Virtuoso
                ref={virtuosoRef}
                data={messages}
                computeItemKey={(_, message) => message.id}
                atBottomStateChange={setIsAtBottom}
                followOutput={(atBottom) => (atBottom ? "smooth" : false)}
                initialTopMostItemIndex={initialMessageIndex}
                components={VIRTUOSO_COMPONENTS}
                itemContent={(_, message) => (
                  <ChatFeedItem
                    comment={message.comment}
                    isOwnMessage={message.isOwnMessage}
                  />
                )}
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
      </div>

<<<<<<< Updated upstream
      <AiTypingIndicator />
=======
      <AiTypingIndicator visible={typingVisible} persona={aiAgent?.activePersona ?? null} />

>>>>>>> Stashed changes
      <div className="relative border-t border-white/[0.06] p-2">
        <SlashCommandMenu
          visible={slash.menuOpen && aiAgent != null}
          filter={slash.filter}
          selectedIndex={slash.selectedIndex}
          onSelect={slash.selectCommand}
        />
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={slash.handleKeyDown}
<<<<<<< Updated upstream
            placeholder={aiAgent ? 'Type / for AI personas or message...' : "Type a message..."}
=======
            placeholder={
              aiAgent
                ? "Type / for AI personas or message..."
                : "Type a message..."
            }
>>>>>>> Stashed changes
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
    </div>
  )
}
