import * as React from "react"
import { Bot, Palette, MessageSquareWarning, Megaphone } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

type SlashCommand = {
  id: string
  label: string
  prefix: string
  description: string
  icon: typeof Bot
  color: string
}

const COMMANDS: SlashCommand[] = [
  { id: "agent", label: "Agent", prefix: "@agent ", description: "Auto-route to best persona", icon: Bot, color: "text-lime-500" },
  { id: "designer", label: "Designer", prefix: "@designer ", description: "Layout, structure, visual flow", icon: Palette, color: "text-blue-400" },
  { id: "critique", label: "Critique", prefix: "@critique ", description: "Review, feedback, improvements", icon: MessageSquareWarning, color: "text-orange-400" },
  { id: "marketing", label: "Marketing", prefix: "@marketing ", description: "Copy, brand, messaging", icon: Megaphone, color: "text-yellow-400" },
]

type SlashCommandMenuProps = {
  visible: boolean
  filter: string
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
}

export function SlashCommandMenu({ visible, filter, selectedIndex, onSelect }: SlashCommandMenuProps) {
  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <AnimatePresence>
      {visible && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.1 }}
          className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-white/[0.08] bg-sidebar p-1 shadow-lg"
        >
          {filtered.map((cmd, index) => {
            const Icon = cmd.icon
            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => onSelect(cmd)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  index === selectedIndex
                    ? "bg-white/[0.08] text-foreground"
                    : "text-foreground/70 hover:bg-white/[0.04]"
                )}
              >
                <Icon className={cn("size-4 shrink-0", cmd.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{cmd.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground/60">{cmd.description}</p>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function useSlashCommands(input: string, setInput: (v: string) => void) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  // Detect "/" at start of input
  const slashMatch = input.match(/^\/(\w*)$/)
  const isSlashActive = slashMatch != null
  const filter = slashMatch?.[1] ?? ""

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  )

  React.useEffect(() => {
    setMenuOpen(isSlashActive)
    if (isSlashActive) setSelectedIndex(0)
  }, [isSlashActive])

  function selectCommand(cmd: SlashCommand) {
    setInput(cmd.prefix)
    setMenuOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!menuOpen || filtered.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (menuOpen) {
        e.preventDefault()
        selectCommand(filtered[selectedIndex])
      }
    } else if (e.key === "Escape") {
      setMenuOpen(false)
    }
  }

  return { menuOpen, filter, selectedIndex, selectCommand, handleKeyDown }
}

export type { SlashCommand }
