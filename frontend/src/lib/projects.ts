import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"

import { buildApiUrl } from "@/lib/api"
import { getAccessToken, useAuth } from "@/lib/auth"

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

type BoardResponse = {
  id: string
  name: string
  owner_id: string
  created_at: string
  updated_at: string
}

type ProjectsState = {
  projects: Project[]
  syncToken: string | null
}

const projectsState: ProjectsState = {
  projects: [],
  syncToken: null,
}

function mapBoardToProject(board: BoardResponse, currentUser: ProjectUser): Project {
  return {
    id: board.id,
    name: board.name,
    owner:
      board.owner_id === currentUser.id
        ? currentUser
        : { id: board.owner_id, name: "Owner" },
    onlineUsers: [],
    lastOpenedAt: board.updated_at,
    lastOpenedBy: null,
    createdAt: board.created_at,
    updatedAt: board.updated_at,
  }
}

function setProjects(projects: Project[], syncToken: string | null) {
  projectsState.projects = projects
  projectsState.syncToken = syncToken
  notifyListeners()
}

function updateProjects(updater: (projects: Project[]) => Project[]) {
  projectsState.projects = updater(projectsState.projects)
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
  return projectsState.projects
}

// ---- API calls ----

async function requestBoards(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = getAccessToken()

  if (!accessToken) {
    throw new Error("Missing access token")
  }

  return fetch(buildApiUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
}

async function fetchProjects(currentUser: ProjectUser) {
  const response = await requestBoards("/boards")

  if (!response.ok) {
    throw new Error("Failed to fetch projects")
  }

  const boards = (await response.json()) as BoardResponse[]
  setProjects(
    boards.map((board) => mapBoardToProject(board, currentUser)),
    getAccessToken()
  )
}

// ---- public hook ----

export function useProjects() {
  const { user } = useAuth()
  const projects = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const currentUser: ProjectUser = useMemo(
    () => ({
      id: user?.id ?? "",
      name: user?.email ?? "You",
    }),
    [user?.email, user?.id]
  )

  useEffect(() => {
    const accessToken = getAccessToken()

    if (!currentUser.id || !accessToken) {
      if (projectsState.projects.length > 0 || projectsState.syncToken !== null) {
        setProjects([], null)
      }
      return
    }

    if (projectsState.syncToken === accessToken) {
      updateProjects((currentProjects) =>
        currentProjects.map((project) => ({
          ...project,
          owner:
            project.owner.id === currentUser.id ? currentUser : project.owner,
        }))
      )
      return
    }

    void fetchProjects(currentUser)
  }, [currentUser])

  const createProject = useCallback(
    async (name: string): Promise<Project> => {
      const response = await requestBoards("/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error("Failed to create project")
      }

      const board = (await response.json()) as BoardResponse
      const project = mapBoardToProject(board, currentUser)
      updateProjects((currentProjects) => [project, ...currentProjects])
      return project
    },
    [currentUser]
  )

  const renameProject = useCallback((id: string, name: string) => {
    updateProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === id
          ? { ...project, name, updatedAt: new Date().toISOString() }
          : project
      )
    )
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    const response = await requestBoards(`/boards/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error("Failed to delete project")
    }

    updateProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== id)
    )
  }, [])

  const joinProject = useCallback(
    async (id: string): Promise<Project> => {
      const addMemberResponse = await requestBoards(`/boards/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, role: "editor" }),
      })

      if (!addMemberResponse.ok) {
        throw new Error("Failed to join project")
      }

      const projectResponse = await requestBoards(`/boards/${id}`)

      if (!projectResponse.ok) {
        throw new Error("Failed to fetch project")
      }

      const board = (await projectResponse.json()) as BoardResponse
      const project = mapBoardToProject(board, currentUser)
      updateProjects((currentProjects) => {
        const otherProjects = currentProjects.filter(
          (currentProject) => currentProject.id !== id
        )
        return [project, ...otherProjects]
      })
      return project
    },
    [currentUser]
  )

  const touchProject = useCallback((id: string) => {
    const now = new Date().toISOString()
    updateProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === id
          ? {
              ...project,
              lastOpenedAt: now,
              lastOpenedBy: currentUser,
              updatedAt: now,
            }
          : project
      )
    )
  }, [currentUser])

  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id) ?? null,
    [projects]
  )

  return {
    projects,
    createProject,
    renameProject,
    deleteProject,
    joinProject,
    touchProject,
    getProject,
    currentUser,
  }
}
