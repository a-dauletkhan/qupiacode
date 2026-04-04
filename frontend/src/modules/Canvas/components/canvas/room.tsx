
import type { ReactNode } from "react"
import * as React from "react"
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense"
import { LoaderCircle } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { getAccessToken, useAuth } from "@/lib/auth"
import { buildApiUrl } from "@/lib/api"

type RoomProps = {
  id: string
  children: ReactNode
}

const AUTH_URL = buildApiUrl("/api/liveblocks/auth")
const RESOLVE_USERS_URL = buildApiUrl("/api/liveblocks/resolve-users")

export function Room({ id, children }: RoomProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const hasRedirectedRef = React.useRef(false)
  const returnPath = `${location.pathname}${location.search}${location.hash}`

  const redirectToLogin = React.useCallback(() => {
    if (hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true
    logout()
    navigate("/login", {
      replace: true,
      state: { from: returnPath },
    })
  }, [logout, navigate, returnPath])

  return (
    <LiveblocksProvider
      resolveUsers={async ({ userIds }) => {
        const fallbackUsers = userIds.map((userId) => ({
          name: userId,
          avatar: "",
        }))
        const token = getAccessToken()
        if (!token) {
          redirectToLogin()
          return fallbackUsers
        }

        const resp = await fetch(RESOLVE_USERS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userIds }),
        })
        if (resp.status === 401 || resp.status === 403) {
          redirectToLogin()
          return fallbackUsers
        }

        if (!resp.ok) {
          return fallbackUsers
        }

        return resp.json()
      }}
      authEndpoint={async (room) => {
        const token = getAccessToken()
        if (!token) {
          redirectToLogin()
          throw new Error("Missing access token")
        }

        const resp = await fetch(AUTH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ room }),
        })
        if (resp.status === 401 || resp.status === 403) {
          redirectToLogin()
          throw new Error(`Liveblocks auth failed: ${resp.status}`)
        }

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
    <div className="flex h-screen w-full items-center justify-center">
      <LoaderCircle className="size-8 animate-spin text-lime-400" />
    </div>
  )
}
