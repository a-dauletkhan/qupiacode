"use client"

import type { ReactNode } from "react"
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense"
import { LoaderCircle } from "lucide-react"

type RoomProps = {
  id: string
  children: ReactNode
}

export function Room({ id, children }: RoomProps) {
  return (
    <LiveblocksProvider
      authEndpoint={`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/liveblocks/auth`}
    >
      <RoomProvider
        id={id}
        initialPresence={{ cursor: null, type: "user" }}
        initialStorage={{ agentIntensity: "balanced" }}
      >
        <ClientSideSuspense fallback={<RoomLoadingFallback />}>
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  )
}

function RoomLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-lime-400" />
    </div>
  )
}
