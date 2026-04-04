import { useThreads, useCreateThread } from "@liveblocks/react/suspense"
import { Thread } from "@liveblocks/react-ui"
import { useState, useRef } from "react"
import { Send } from "lucide-react"
import "@liveblocks/react-ui/styles.css"

export function Chat() {
  const { threads } = useThreads()
  const createThread = useCreateThread()
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    createThread({
      body: {
        version: 1,
        content: [{ type: "paragraph", children: [{ text }] }],
      },
      metadata: {},
    })

    setInput("")
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {threads.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No messages yet
          </div>
        ) : (
          threads.map((thread) => (
            <Thread key={thread.id} thread={thread} className="mb-2" />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
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
