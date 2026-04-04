import { Check, X } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/modules/Canvas/components/ui/button"

type AiActionBarProps = {
  onApprove: () => void
  onReject: () => void
}

export function AiActionBar({ onApprove, onReject }: AiActionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="nodrag nopan nowheel absolute -bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5 shadow-md"
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onApprove()
        }}
        className="h-6 gap-1 rounded-md px-2 text-[10px] font-medium text-lime-500 hover:bg-lime-500/10 hover:text-lime-400"
      >
        <Check className="size-3" />
        Approve
      </Button>
      <div className="h-4 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onReject()
        }}
        className="h-6 gap-1 rounded-md px-2 text-[10px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        <X className="size-3" />
        Reject
      </Button>
    </motion.div>
  )
}
