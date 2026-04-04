import { MicOffIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { VolumeSlider } from "@/modules/VoiceCall/components/volume-slider"

const avatarVariants = [
  {
    base: "bg-rose-50",
    blob1:
      "top-0 left-0.5 size-9 bg-linear-to-br from-rose-200 via-orange-300 to-amber-400",
    blob2:
      "top-2 left-3 size-5 bg-linear-to-br from-fuchsia-400 via-pink-500 to-rose-500",
    blob3:
      "top-5 left-1 size-8 bg-linear-to-br from-amber-300 via-red-500 to-fuchsia-600",
  },
  {
    base: "bg-emerald-50",
    blob1:
      "-top-1 left-1 size-8 bg-linear-to-br from-emerald-200 via-lime-300 to-green-400",
    blob2:
      "top-3 left-4 size-6 bg-linear-to-br from-teal-400 via-emerald-500 to-green-600",
    blob3:
      "top-4 -left-1 size-9 bg-linear-to-br from-lime-300 via-green-500 to-teal-600",
  },
  {
    base: "bg-sky-50",
    blob1:
      "top-0 -left-1 size-8 bg-linear-to-br from-sky-200 via-cyan-300 to-blue-400",
    blob2:
      "top-1 left-3 size-7 bg-linear-to-br from-indigo-400 via-blue-500 to-cyan-500",
    blob3:
      "top-5 left-0 size-8 bg-linear-to-br from-blue-300 via-sky-500 to-indigo-600",
  },
  {
    base: "bg-violet-50",
    blob1:
      "top-1 left-0 size-7 bg-linear-to-br from-violet-200 via-purple-300 to-fuchsia-400",
    blob2:
      "-top-1 left-3 size-8 bg-linear-to-br from-purple-400 via-violet-500 to-indigo-500",
    blob3:
      "top-4 left-2 size-8 bg-linear-to-br from-fuchsia-300 via-purple-500 to-violet-600",
  },
  {
    base: "bg-orange-50",
    blob1:
      "-top-2 left-0 size-9 bg-linear-to-br from-yellow-200 via-orange-300 to-red-400",
    blob2:
      "top-2 left-4 size-5 bg-linear-to-br from-orange-400 via-amber-500 to-yellow-500",
    blob3:
      "top-4 left-0 size-9 bg-linear-to-br from-red-300 via-orange-500 to-amber-600",
  },
  {
    base: "bg-pink-50",
    blob1:
      "top-0 left-2 size-8 bg-linear-to-br from-pink-200 via-rose-300 to-fuchsia-400",
    blob2:
      "top-2 -left-1 size-6 bg-linear-to-br from-rose-400 via-pink-500 to-purple-500",
    blob3:
      "top-4 left-3 size-7 bg-linear-to-br from-fuchsia-300 via-rose-500 to-pink-600",
  },
  {
    base: "bg-cyan-50",
    blob1:
      "top-0 left-0 size-8 bg-linear-to-br from-cyan-200 via-teal-300 to-emerald-400",
    blob2:
      "top-1 left-4 size-6 bg-linear-to-br from-sky-400 via-cyan-500 to-teal-500",
    blob3:
      "top-5 left-1 size-7 bg-linear-to-br from-emerald-300 via-teal-500 to-cyan-600",
  },
  {
    base: "bg-indigo-50",
    blob1:
      "-top-1 left-2 size-8 bg-linear-to-br from-indigo-200 via-blue-300 to-violet-400",
    blob2:
      "top-3 left-0 size-6 bg-linear-to-br from-blue-400 via-indigo-500 to-violet-500",
    blob3:
      "top-4 left-4 size-7 bg-linear-to-br from-violet-300 via-indigo-500 to-blue-600",
  },
  {
    base: "bg-lime-50",
    blob1:
      "top-0 left-1 size-7 bg-linear-to-br from-lime-200 via-green-300 to-emerald-400",
    blob2:
      "top-2 left-3 size-7 bg-linear-to-br from-yellow-400 via-lime-500 to-green-500",
    blob3:
      "top-5 -left-1 size-8 bg-linear-to-br from-emerald-300 via-lime-500 to-green-600",
  },
  {
    base: "bg-slate-50",
    blob1:
      "top-1 -left-1 size-8 bg-linear-to-br from-slate-200 via-gray-300 to-zinc-400",
    blob2:
      "-top-1 left-4 size-6 bg-linear-to-br from-cyan-400 via-slate-500 to-indigo-500",
    blob3:
      "top-4 left-1 size-8 bg-linear-to-br from-zinc-300 via-slate-500 to-gray-600",
  },
] as const

function getAvatarVariant(name: string) {
  const hash = [...name].reduce(
    (accumulator, character) => accumulator + character.charCodeAt(0),
    0
  )

  return avatarVariants[hash % avatarVariants.length]
}

type CallUserProps = {
  name: string
  status: string
  isMuted?: boolean
  className?: string
}

export function CallUserCard({
  name,
  status,
  isMuted = false,
  className,
}: CallUserProps) {
  const avatarVariant = getAvatarVariant(name)

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-r border-b border-l border-sidebar-border bg-sidebar p-2",
        className
      )}
    >
      <div className="relative flex size-8 overflow-hidden rounded-full bg-primary/10">
        <div className={cn("absolute inset-0", avatarVariant.base)}>
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob1
            )}
          />
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob2
            )}
          />
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob3
            )}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{status}</p>
      </div>

      {isMuted ? <MicOffIcon className="size-4 text-destructive" /> : null}

      <VolumeSlider />
    </div>
  )
}

export function CallAgentCard({ className }: { className?: string }) {
  const avatarVariant = getAvatarVariant("AI Agent")

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border border-sidebar-border bg-sidebar p-2",
        className
      )}
    >
      <div className="relative flex size-8 overflow-hidden rounded-full bg-primary/10">
        <div className={cn("absolute inset-0", avatarVariant.base)}>
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob1
            )}
          />
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob2
            )}
          />
          <div
            className={cn(
              "absolute rounded-full blur-[2px]",
              avatarVariant.blob3
            )}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">
          AI Agent
        </p>
        <p className="text-xs text-muted-foreground">Online</p>
      </div>

      <VolumeSlider />
    </div>
  )
}
