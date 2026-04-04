import { useCallback, useSyncExternalStore } from "react"

export type ProjectUser = {
  id: string
  name: string
  avatarUrl?: string
}

export type Project = {
  id: string
  name: string
  owner: ProjectUser
  onlineUsers: ProjectUser[]
  lastOpenedAt: string
  lastOpenedBy: ProjectUser | null
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = "qupia_projects"

// Placeholder current user — will come from auth in production
const CURRENT_USER: ProjectUser = {
  id: "user-self",
  name: "You",
}

function generateId() {
  return `proj-${Date.now()}-${Math.round(Math.random() * 1000)}`
}

function migrateProject(raw: Record<string, unknown>): Project {
  return {
    id: (raw.id as string) ?? generateId(),
    name: (raw.name as string) ?? "Untitled",
    owner: (raw.owner as ProjectUser) ?? CURRENT_USER,
    onlineUsers: (raw.onlineUsers as ProjectUser[]) ?? [],
    lastOpenedAt: (raw.lastOpenedAt as string) ?? (raw.updatedAt as string) ?? new Date().toISOString(),
    lastOpenedBy: (raw.lastOpenedBy as ProjectUser | null) ?? null,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (raw.updatedAt as string) ?? new Date().toISOString(),
  }
}

function readProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>[]
    return parsed.map(migrateProject)
  } catch {
    return []
  }
}

function writeProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
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
  return localStorage.getItem(STORAGE_KEY) ?? "[]"
}

// ---- mock collaborators ----

const MOCK_COLLABORATORS: ProjectUser[] = [
  { id: "user-a", name: "Alice" },
  { id: "user-b", name: "Bob" },
  { id: "user-c", name: "Charlie" },
  { id: "user-d", name: "Dana" },
]

function pickRandomCollaborators(max: number): ProjectUser[] {
  const count = Math.floor(Math.random() * (max + 1))
  const shuffled = [...MOCK_COLLABORATORS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// ---- public hook ----

export function useProjects() {
  const raw = useSyncExternalStore(subscribe, getSnapshot)
  const projects: Project[] = (JSON.parse(raw) as Record<string, unknown>[]).map(migrateProject)

  const createProject = useCallback((name: string): Project => {
    const now = new Date().toISOString()
    const project: Project = {
      id: generateId(),
      name,
      owner: CURRENT_USER,
      onlineUsers: [],
      lastOpenedAt: now,
      lastOpenedBy: CURRENT_USER,
      createdAt: now,
      updatedAt: now,
    }
    writeProjects([project, ...readProjects()])
    return project
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    writeProjects(
      readProjects().map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
      )
    )
  }, [])

  const deleteProject = useCallback((id: string) => {
    writeProjects(readProjects().filter((p) => p.id !== id))
  }, [])

  const touchProject = useCallback((id: string) => {
    const now = new Date().toISOString()
    writeProjects(
      readProjects().map((p) =>
        p.id === id
          ? {
              ...p,
              lastOpenedAt: now,
              lastOpenedBy: CURRENT_USER,
              onlineUsers: pickRandomCollaborators(3),
              updatedAt: now,
            }
          : p
      )
    )
  }, [])

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id) ?? null,
    [projects]
  )

  return {
    projects,
    createProject,
    renameProject,
    deleteProject,
    touchProject,
    getProject,
    currentUser: CURRENT_USER,
  }
}
