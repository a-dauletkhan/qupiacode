"use client"

import { useEffect, type ReactNode } from "react"
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
  useOthers,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense"
import { LoaderCircle } from "lucide-react"

import { getAccessToken, useAuth } from "@/lib/auth"

type RoomProps = {
  id: string
  children: ReactNode
}

export function Room({ id, children }: RoomProps) {
  return (
    <LiveblocksProvider authEndpoint={authorizeLiveblocksRoom}>
      <RoomProvider
        id={id}
        initialPresence={{ cursor: null, userName: null }}
      >
        <ClientSideSuspense fallback={<RoomLoadingFallback />}>
          <RoomPresence>
            {children}
          </RoomPresence>
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  )
}

async function authorizeLiveblocksRoom(room?: string) {
  const accessToken = getAccessToken()

  if (!accessToken) {
    throw new Error("Sign in before joining a Liveblocks room")
  }

  const response = await fetch("/auth/liveblocks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ room }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody.error || "Failed to authorize Liveblocks room")
  }

  return response.json()
}

function RoomPresence({ children }: { children: ReactNode }) {
  const updateMyPresence = useUpdateMyPresence()
  const others = useOthers()
  const { user } = useAuth()

  useEffect(() => {
    updateMyPresence({
      userName: formatPresenceUserName(user?.email),
    })
  }, [updateMyPresence, user?.email])

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 right-16 z-30 rounded-xl border border-border bg-card/80 px-3 py-2 text-xs text-foreground backdrop-blur">
        <div className="font-medium">Online users</div>
        {others.length === 0 ? (
          <div className="mt-1 text-muted-foreground">No one else online</div>
        ) : (
          <div className="mt-1 space-y-1 text-muted-foreground">
            {others.map((otherUser) => (
              <p key={otherUser.connectionId}>
                {otherUser.presence.userName || "Anonymous"}
              </p>
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}

function formatPresenceUserName(email: string | null | undefined) {
  if (!email?.trim()) {
    return "Anonymous"
  }

  const [localPart] = email.split("@")
  const displayName = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")

  return displayName || email
}

function RoomLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-lime-400" />
    </div>
  )
}
