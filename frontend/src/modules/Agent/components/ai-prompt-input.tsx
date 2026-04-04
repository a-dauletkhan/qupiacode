import * as React from "react"
import { Bot, Send, X } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/modules/Canvas/components/ui/button"

type AiPromptInputProps = {
  selectedCount: number
  onSubmit: (message: string) => void
  onClose: () => void
}

export function AiPromptInput({ selectedCount, onSubmit, onClose }: AiPromptInputProps) {
  const [value, setValue] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue("")
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="nodrag nopan nowheel w-72 rounded-xl border border-border bg-card p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Bot className="size-3.5 text-lime-500" />
          <span className="text-xs font-semibold text-foreground">Ask AI</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </Button>
      </div>

      <p className="mb-2 text-[10px] text-muted-foreground">
        {selectedCount} node{selectedCount !== 1 ? "s" : ""} selected
      </p>

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What should AI do?"
          className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-lime-500"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
          }}
        />
        <Button
          type="submit"
          disabled={!value.trim()}
          size="sm"
          className="h-7 rounded-lg bg-lime-500 px-2.5 text-black hover:bg-lime-400 disabled:opacity-50"
        >
          <Send className="size-3" />
        </Button>
      </form>
    </motion.div>
  )
}
