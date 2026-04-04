"use client"

import type { ReactNode } from "react"
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense"
import { LoaderCircle } from "lucide-react"

const DEFAULT_LIVEBLOCKS_PUBLIC_KEY =
  "pk_dev_QFb5pt_0sDb3LVyB6vICx5N3k2q1o5QG-MwHURHnRK3aYYJPrcJSshC7zbucmT8c"

type RoomProps = {
  children: ReactNode
}

export function Room({ children }: RoomProps) {
  return (
    <LiveblocksProvider
      publicApiKey={
        import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ??
        DEFAULT_LIVEBLOCKS_PUBLIC_KEY
      }
    >
      <RoomProvider id="my-room" initialPresence={{ cursor: null }}>
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
