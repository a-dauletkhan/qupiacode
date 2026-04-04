import { useCallback, useSyncExternalStore } from "react"

// ---- types ----

export type AuthUser = {
  id: string
  email: string
}

type AuthSession = {
  access_token: string
  refresh_token: string
  user: AuthUser
}

type AuthState = {
  session: AuthSession | null
}

// ---- API errors ----

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "AuthError"
    this.status = status
  }
}

// ---- storage ----

const STORAGE_KEY = "higjam_auth"

function readState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthState) : { session: null }
  } catch {
    return { session: null }
  }
}

function writeState(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  notifyListeners()
}

// ---- external store for useSyncExternalStore ----

type Listener = () => void
const listeners = new Set<Listener>()

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners() {
  listeners.forEach((l) => l())
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) ?? '{"session":null}'
}

// ---- API calls ----

async function apiLogin(email: string, password: string): Promise<AuthSession> {
  const resp = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    const message =
      (body as Record<string, string>).detail ??
      (body as Record<string, string>).error_description ??
      "Login failed"
    throw new AuthError(message, resp.status)
  }

  const data = await resp.json()
  return parseSupabaseResponse(data)
}

async function apiSignup(email: string, password: string, name: string): Promise<AuthSession> {
  const resp = await fetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    const message =
      (body as Record<string, string>).detail ??
      (body as Record<string, string>).msg ??
      "Signup failed"
    throw new AuthError(message, resp.status)
  }

  const data = await resp.json()
  return parseSupabaseResponse(data)
}

function parseSupabaseResponse(data: Record<string, unknown>): AuthSession {
  const accessToken = (data.access_token as string) ?? ""
  const refreshToken = (data.refresh_token as string) ?? ""
  const rawUser = (data.user as Record<string, unknown>) ?? {}

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: (rawUser.id as string) ?? "",
      email: (rawUser.email as string) ?? "",
    },
  }
}

// ---- public: access token getter ----

export function getAccessToken(): string | null {
  return readState().session?.access_token ?? null
}

// ---- public hook ----

export function useAuth() {
  const raw = useSyncExternalStore(subscribe, getSnapshot)
  const state: AuthState = JSON.parse(raw)
  const session = state.session

  const login = useCallback(async (email: string, password: string) => {
    const authSession = await apiLogin(email, password)
    writeState({ session: authSession })
    return authSession.user
  }, [])

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const authSession = await apiSignup(email, password, name)
    writeState({ session: authSession })
    return authSession.user
  }, [])

  const logout = useCallback(() => {
    writeState({ session: null })
  }, [])

  return {
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
    isAuthenticated: session !== null && Boolean(session.access_token),
    login,
    signup,
    logout,
  }
}
