import { Bot } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/modules/Canvas/components/ui/button"

type AiAskButtonProps = {
  visible: boolean
  selectedCount: number
  onClick: () => void
}

export function AiAskButton({ visible, selectedCount, onClick }: AiAskButtonProps) {
  return (
    <motion.div
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 8,
        scale: visible ? 1 : 0.95,
      }}
      transition={{ duration: 0.15 }}
      style={{ pointerEvents: visible ? "auto" : "none" }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        tabIndex={visible ? 0 : -1}
        className="gap-1.5 border-lime-500/30 bg-card/90 text-xs text-foreground shadow-md backdrop-blur hover:border-lime-500/50 hover:bg-lime-500/10"
      >
        <Bot className="size-3.5 text-lime-500" />
        Ask AI
        <span className="rounded bg-lime-500/15 px-1 py-0.5 text-[10px] font-medium text-lime-500">
          {selectedCount}
        </span>
      </Button>
    </motion.div>
  )
}
