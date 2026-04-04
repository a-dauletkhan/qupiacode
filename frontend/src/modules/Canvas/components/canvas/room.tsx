"use client"

import type { ReactNode } from "react"
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense"
import { LoaderCircle } from "lucide-react"
import { getAccessToken } from "@/lib/auth"
import { buildApiUrl } from "@/lib/api"

type RoomProps = {
  id: string
  children: ReactNode
}

const AUTH_URL = buildApiUrl("/api/liveblocks/auth")

export function Room({ id, children }: RoomProps) {
  return (
    <LiveblocksProvider
      authEndpoint={async (room) => {
        const token = getAccessToken()
        const resp = await fetch(AUTH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ room }),
        })
        if (!resp.ok) {
          throw new Error(`Liveblocks auth failed: ${resp.status}`)
        }
        return resp.json()
      }}
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
