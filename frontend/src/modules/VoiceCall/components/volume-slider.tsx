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
  className?: string
}

export function VolumeSlider({
  defaultValue = 75,
  className,
}: VolumeSliderProps) {
  const [volume, setVolume] = React.useState(defaultValue)
  const VolumeIcon = volume === 0 ? VolumeOffIcon : Volume2Icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground", className)}
        >
          <VolumeIcon className="size-4" />
          <span className="sr-only">Adjust user volume</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40 p-3">
        <div className="flex items-center gap-2">
          <VolumeIcon className="size-4 shrink-0 text-muted-foreground" />
          <Slider
            min={0}
            max={100}
            step={1}
            value={[volume]}
            onValueChange={([nextVolume]) => setVolume(nextVolume ?? 0)}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
