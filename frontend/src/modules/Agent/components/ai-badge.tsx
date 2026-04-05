import { Bot, Palette, MessageSquareWarning, Megaphone } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

type AiBadgeProps = {
  status: "pending" | "approved"
  persona?: string
  personaColor?: string
  className?: string
}

const PERSONA_ICONS: Record<string, typeof Bot> = {
  designer: Palette,
  critique: MessageSquareWarning,
  marketing: Megaphone,
}

export function AiBadge({ status, persona, personaColor, className }: AiBadgeProps) {
  const Icon = (persona && PERSONA_ICONS[persona]) || Bot
  const label = persona ? persona.charAt(0).toUpperCase() + persona.slice(1) : "AI"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "pointer-events-none absolute -right-2 -top-2 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5",
        status === "pending"
          ? "text-white"
          : "bg-muted/80 text-muted-foreground",
        className
      )}
      style={status === "pending" && personaColor ? {
        backgroundColor: `color-mix(in srgb, ${personaColor} 25%, transparent)`,
        color: personaColor,
      } : undefined}
    >
      <Icon className="size-2.5" />
      <span className="text-[8px] font-semibold uppercase tracking-wider">
        {label}
      </span>
    </motion.div>
  )
}
