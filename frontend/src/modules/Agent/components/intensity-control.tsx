import { useMutation, useStorage } from "@liveblocks/react/suspense"
import { Volume, Volume1, Volume2 } from "lucide-react"

const intensityOptions = [
  { value: "quiet" as const, label: "Quiet", icon: Volume },
  { value: "balanced" as const, label: "Balanced", icon: Volume1 },
  { value: "active" as const, label: "Active", icon: Volume2 },
]

export function IntensityControl() {
  const intensity = useStorage((root) => root.agentIntensity)

  const setIntensity = useMutation(({ storage }, value: "quiet" | "balanced" | "active") => {
    storage.set("agentIntensity", value)
  }, [])

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
      {intensityOptions.map((option) => {
        const Icon = option.icon
        const isActive = intensity === option.value

        return (
          <button
            key={option.value}
            onClick={() => setIntensity(option.value)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              isActive
                ? "bg-lime-500/15 text-lime-500"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={`Set AI agent to ${option.label} mode`}
          >
            <Icon className="size-3" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
