import * as React from "react"
import { Volume2Icon, VolumeOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

type VolumeSliderProps = {
  defaultValue?: number
  value?: number
  disabled?: boolean
  onValueChange?: (nextValue: number) => void
  className?: string
}

export function VolumeSlider({
  defaultValue = 75,
  value,
  disabled = false,
  onValueChange,
  className,
}: VolumeSliderProps) {
  const [internalVolume, setInternalVolume] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const volume = isControlled ? value : internalVolume
  const VolumeIcon = volume === 0 ? VolumeOffIcon : Volume2Icon

  const handleVolumeChange = React.useCallback(
    ([nextVolume]: number[]) => {
      const safeVolume = nextVolume ?? 0
      if (!isControlled) {
        setInternalVolume(safeVolume)
      }
      onValueChange?.(safeVolume)
    },
    [isControlled, onValueChange]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
          disabled={disabled}
        >
          <VolumeIcon className="size-4" />
          <span className="sr-only">Adjust user volume</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40 p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={handleToggleMute}
          >
            <VolumeIcon className="size-4" />
            <span className="sr-only">Toggle mute</span>
          </Button>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[volume]}
            onValueChange={handleVolumeChange}
            disabled={disabled}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
