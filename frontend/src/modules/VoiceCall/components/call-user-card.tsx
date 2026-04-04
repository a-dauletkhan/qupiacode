import { MicOffIcon } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const avatarVariants = [
  {
    base: "bg-rose-100",
    blob1:
      "top-0 left-0.5 size-9 bg-linear-to-br from-rose-300 via-orange-500 to-amber-600",
    blob2:
      "top-2 left-3 size-5 bg-linear-to-br from-fuchsia-500 via-pink-600 to-rose-600",
    blob3:
      "top-5 left-1 size-8 bg-linear-to-br from-amber-400 via-red-600 to-fuchsia-700",
  },
  {
    base: "bg-sky-100",
    blob1:
      "top-0 -left-1 size-8 bg-linear-to-br from-sky-300 via-cyan-500 to-blue-600",
    blob2:
      "top-1 left-3 size-7 bg-linear-to-br from-indigo-500 via-blue-600 to-cyan-600",
    blob3:
      "top-5 left-0 size-8 bg-linear-to-br from-blue-400 via-sky-600 to-indigo-700",
  },
  {
    base: "bg-violet-100",
    blob1:
      "top-1 left-0 size-7 bg-linear-to-br from-violet-300 via-purple-500 to-fuchsia-600",
    blob2:
      "-top-1 left-3 size-8 bg-linear-to-br from-purple-500 via-violet-600 to-indigo-600",
    blob3:
      "top-4 left-2 size-8 bg-linear-to-br from-fuchsia-400 via-purple-600 to-violet-700",
  },
  {
    base: "bg-orange-100",
    blob1:
      "-top-2 left-0 size-9 bg-linear-to-br from-yellow-300 via-orange-500 to-red-600",
    blob2:
      "top-2 left-4 size-5 bg-linear-to-br from-orange-500 via-amber-600 to-yellow-500",
    blob3:
      "top-4 left-0 size-9 bg-linear-to-br from-red-400 via-orange-600 to-amber-700",
  },
  {
    base: "bg-pink-100",
    blob1:
      "top-0 left-2 size-8 bg-linear-to-br from-pink-300 via-rose-500 to-fuchsia-600",
    blob2:
      "top-2 -left-1 size-6 bg-linear-to-br from-rose-500 via-pink-600 to-purple-600",
    blob3:
      "top-4 left-3 size-7 bg-linear-to-br from-fuchsia-400 via-rose-600 to-pink-700",
  },
  {
    base: "bg-cyan-100",
    blob1:
      "top-0 left-0 size-8 bg-linear-to-br from-cyan-300 via-teal-500 to-emerald-600",
    blob2:
      "top-1 left-4 size-6 bg-linear-to-br from-sky-500 via-cyan-600 to-teal-600",
    blob3:
      "top-5 left-1 size-7 bg-linear-to-br from-emerald-400 via-teal-600 to-cyan-700",
  },
  {
    base: "bg-indigo-100",
    blob1:
      "-top-1 left-2 size-8 bg-linear-to-br from-indigo-300 via-blue-500 to-violet-600",
    blob2:
      "top-3 left-0 size-6 bg-linear-to-br from-blue-500 via-indigo-600 to-violet-600",
    blob3:
      "top-4 left-4 size-7 bg-linear-to-br from-violet-400 via-indigo-600 to-blue-700",
  },
  {
    base: "bg-lime-100",
    blob1:
      "top-0 left-1 size-7 bg-linear-to-br from-lime-300 via-green-500 to-emerald-600",
    blob2:
      "top-2 left-3 size-7 bg-linear-to-br from-yellow-500 via-lime-600 to-green-600",
    blob3:
      "top-5 -left-1 size-8 bg-linear-to-br from-emerald-400 via-lime-600 to-green-700",
  },
  {
    base: "bg-slate-100",
    blob1:
      "top-1 -left-1 size-8 bg-linear-to-br from-slate-300 via-gray-500 to-zinc-600",
    blob2:
      "-top-1 left-4 size-6 bg-linear-to-br from-cyan-500 via-slate-600 to-indigo-600",
    blob3:
      "top-4 left-1 size-8 bg-linear-to-br from-zinc-400 via-slate-600 to-gray-700",
  },
] as const

function getAvatarVariant(name: string) {
  const hash = [...name].reduce(
    (accumulator, character) => accumulator + character.charCodeAt(0),
    0
  )

  return avatarVariants[hash % avatarVariants.length]
}

function AvatarBlob({
  className,
  isSpeaking,
  maxScale,
  duration,
  delay,
}: {
  className: string
  isSpeaking: boolean
  maxScale: number
  duration: number
  delay: number
}) {
  return (
    <motion.div
      className={cn("absolute rounded-full blur-[2px]", className)}
      animate={{ scale: isSpeaking ? [1, maxScale, 0.92, 1.08, 1] : 1 }}
      transition={{
        duration,
        delay,
        ease: "easeInOut",
        repeat: isSpeaking ? Infinity : 0,
      }}
    />
  )
}

type CallUserProps = {
  name: string
  status: string
  isMuted?: boolean
  isSpeaking?: boolean
  className?: string
}

export function CallUserCard({
  name,
  status,
  isMuted = false,
  isSpeaking = false,
  className,
}: CallUserProps) {
  const avatarVariant = getAvatarVariant(name)

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-r border-b border-l border-sidebar-border bg-sidebar p-2 transition-colors",
        className
      )}
    >
      <div
        className={cn(
          "relative flex size-8 overflow-hidden rounded-full bg-primary/10 outline-2 outline-offset-2 outline-transparent transition-[outline-color]",
          isSpeaking && "outline-lime-500"
        )}
      >
        <div className={cn("absolute inset-0", avatarVariant.base)}>
          <AvatarBlob
            className={avatarVariant.blob1}
            isSpeaking={isSpeaking}
            maxScale={1.2}
            duration={1.2}
            delay={0}
          />
          <AvatarBlob
            className={avatarVariant.blob2}
            isSpeaking={isSpeaking}
            maxScale={1.35}
            duration={0.6}
            delay={0.15}
          />
          <AvatarBlob
            className={avatarVariant.blob3}
            isSpeaking={isSpeaking}
            maxScale={1.25}
            duration={0.8}
            delay={0.3}
          />
        </div>

        <div
          className={cn(
            "absolute inset-0 bg-white/30 transition-opacity duration-200",
            isSpeaking && "opacity-0"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{name}</p>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            isSpeaking && "text-lime-500"
          )}
        >
          {status}
        </p>
      </div>

      {isMuted ? <MicOffIcon className="size-4 text-destructive" /> : null}

    </div>
  )
}
