import { Bot } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

type AiBadgeProps = {
  status: "pending" | "approved"
  className?: string
}

export function AiBadge({ status, className }: AiBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "pointer-events-none absolute -right-2 -top-2 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5",
        status === "pending"
          ? "bg-lime-500/20 text-lime-400"
          : "bg-muted/80 text-muted-foreground",
        className
      )}
    >
      <Bot className="size-2.5" />
      <span className="text-[8px] font-semibold uppercase tracking-wider">
        AI
      </span>
    </motion.div>
  )
}
