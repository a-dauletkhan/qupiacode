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

import { useAuth } from "@/lib/auth"

const DEFAULT_LIVEBLOCKS_PUBLIC_KEY =
  "pk_dev_QFb5pt_0sDb3LVyB6vICx5N3k2q1o5QG-MwHURHnRK3aYYJPrcJSshC7zbucmT8c"

type RoomProps = {
  id: string
  children: ReactNode
}

export function Room({ id, children }: RoomProps) {
  return (
    <LiveblocksProvider
      publicApiKey={
        import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ??
        DEFAULT_LIVEBLOCKS_PUBLIC_KEY
      }
    >
      <RoomProvider
        id={id}
        initialPresence={{ cursor: null, userEmail: null }}
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

function RoomPresence({ children }: { children: ReactNode }) {
  const updateMyPresence = useUpdateMyPresence()
  const others = useOthers()
  const { user } = useAuth()

  useEffect(() => {
    updateMyPresence({
      userEmail: user?.email ?? "Anonymous",
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
                {formatPresenceEmail(otherUser.presence.userEmail)}
              </p>
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}

function formatPresenceEmail(userEmail: unknown) {
  return typeof userEmail === "string" && userEmail.trim()
    ? userEmail
    : "Anonymous"
}

function RoomLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-lime-400" />
    </div>
  )
}
