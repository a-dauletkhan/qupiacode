/**
 * Overlay rendered on top of any canvas node that has `_ai` metadata.
 *
 * Adds:
 *  - Dashed lime border (pending) or subtle border (approved)
 *  - AI badge in the top-right corner
 *  - Approve / Reject action bar below the node (pending only)
 *  - Entry animation via Motion
 */

import { AnimatePresence, motion } from "motion/react"
import type { AiActionStatus } from "../types"
import { AiBadge } from "./ai-badge"
import { AiActionBar } from "./ai-action-bar"
import { cn } from "@/lib/utils"

type AiNodeOverlayProps = {
  status: AiActionStatus
  onApprove: () => void
  onReject: () => void
  children: React.ReactNode
}

export function AiNodeOverlay({
  status,
  onApprove,
  onReject,
  children,
}: AiNodeOverlayProps) {
  const isPending = status === "pending"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "relative h-full w-full",
        isPending && "ai-node-pending"
      )}
    >
      <AiBadge status={isPending ? "pending" : "approved"} />

      {children}

      <AnimatePresence>
        {isPending && (
          <AiActionBar onApprove={onApprove} onReject={onReject} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
