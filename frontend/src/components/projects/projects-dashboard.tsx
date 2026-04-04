import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  EllipsisVertical,
  FolderOpen,
  LayoutGrid,
  List,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { useProjects, type Project, type ProjectUser } from "@/lib/projects"
import { Button } from "@/modules/Canvas/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/Canvas/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/modules/Canvas/components/ui/dropdown-menu"
import { Input } from "@/modules/Canvas/components/ui/input"
import { cn } from "@/lib/utils"

import "./projects-dashboard.css"

type ViewMode = "table" | "grid"

export function ProjectsDashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { projects, createProject, renameProject, deleteProject, touchProject } =
    useProjects()

  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    return (localStorage.getItem("qupia_view_mode") as ViewMode) || "table"
  })

  const [dialogMode, setDialogMode] = React.useState<
    "create" | "rename" | null
  >(null)
  const [dialogValue, setDialogValue] = React.useState("")
  const [targetProject, setTargetProject] = React.useState<Project | null>(null)

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("qupia_view_mode", mode)
  }

  const openCreate = () => {
    setDialogMode("create")
    setDialogValue("")
    setTargetProject(null)
  }

  const openRename = (project: Project) => {
    setDialogMode("rename")
    setDialogValue(project.name)
    setTargetProject(project)
  }

  const closeDialog = () => {
    setDialogMode(null)
    setDialogValue("")
    setTargetProject(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = dialogValue.trim()
    if (!name) return

    if (dialogMode === "create") {
      const project = await createProject(name)
      closeDialog()
      navigate(`/project/${project.id}`)
    } else if (dialogMode === "rename" && targetProject) {
      renameProject(targetProject.id, name)
      closeDialog()
    }
  }

  const handleDelete = async (project: Project) => {
    await deleteProject(project.id)
  }

  const handleOpen = (project: Project) => {
    touchProject(project.id)
    navigate(`/project/${project.id}`)
  }

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Projects</h1>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{user.email}</span>
              <button
                type="button"
                onClick={() => {
                  logout()
                  navigate("/login")
                }}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
          <div className="dashboard-view-toggle">
            <button
              type="button"
              className={cn(
                "dashboard-view-toggle-btn",
                viewMode === "table" && "dashboard-view-toggle-btn-active"
              )}
              onClick={() => switchView("table")}
              aria-label="Table view"
              title="Table view"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              className={cn(
                "dashboard-view-toggle-btn",
                viewMode === "grid" && "dashboard-view-toggle-btn-active"
              )}
              onClick={() => switchView("grid")}
              aria-label="Card view"
              title="Card view"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
          <Button onClick={openCreate} size="sm" className="dashboard-create-btn">
            <Plus className="size-4" />
            New project
          </Button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="dashboard-empty">
          <FolderOpen className="size-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="size-4" />
            Create your first project
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <TableView
          projects={projects}
          onOpen={handleOpen}
          onRename={openRename}
          onDelete={handleDelete}
        />
      ) : (
        <GridView
          projects={projects}
          onOpen={handleOpen}
          onCreate={openCreate}
          onRename={openRename}
          onDelete={handleDelete}
        />
      )}

      <Dialog open={dialogMode !== null} onOpenChange={() => closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "create" ? "New project" : "Rename project"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                autoFocus
                placeholder="Project name"
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!dialogValue.trim()}>
                {dialogMode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- shared props for view components ----

type ProjectViewProps = {
  projects: Project[]
  onOpen: (project: Project) => void
  onRename: (project: Project) => void
  onDelete: (project: Project) => void
}

// ---- table view ----

function TableView({ projects, onOpen, onRename, onDelete }: ProjectViewProps) {
  return (
    <div className="dashboard-table-wrap">
      <div className="dashboard-table-header" role="row">
        <div className="dashboard-col-name" role="columnheader">
          <span>Name</span>
        </div>
        <div className="dashboard-col-online" role="columnheader">
          <span>Online users</span>
        </div>
        <div className="dashboard-col-opened" role="columnheader">
          <span>Last opened</span>
        </div>
        <div className="dashboard-col-owner" role="columnheader">
          <span>Owner</span>
        </div>
        <div className="dashboard-col-options" role="columnheader">
          <span className="sr-only">Options</span>
        </div>
      </div>

      <div className="dashboard-table-body" role="rowgroup">
        {projects.map((project) => (
          <div key={project.id} className="dashboard-row group" role="row">
            <button
              type="button"
              className="dashboard-col-name dashboard-row-cell"
              onClick={() => onOpen(project)}
            >
              <FolderOpen className="size-4 shrink-0 text-primary/70" />
              <span className="truncate">{project.name}</span>
            </button>

            <div className="dashboard-col-online dashboard-row-cell">
              <OnlineAvatars users={project.onlineUsers} />
            </div>

            <div className="dashboard-col-opened dashboard-row-cell">
              <span>{formatRelativeDate(project.lastOpenedAt)}</span>
            </div>

            <div className="dashboard-col-owner dashboard-row-cell">
              <span>{project.owner.name}</span>
            </div>

            <div className="dashboard-col-options dashboard-row-cell">
              <ProjectMenu
                project={project}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- grid / card view ----

function GridView({
  projects,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}: ProjectViewProps & { onCreate: () => void }) {
  return (
    <div className="dashboard-grid">
      <button
        type="button"
        onClick={onCreate}
        className="dashboard-card dashboard-card-new"
      >
        <Plus className="size-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">New project</span>
      </button>

      {projects.map((project) => (
        <div key={project.id} className="dashboard-card group">
          <button
            type="button"
            className="dashboard-card-body"
            onClick={() => onOpen(project)}
          >
            <FolderOpen className="size-8 text-primary/60" />
          </button>

          <div className="dashboard-card-footer">
            <span className="dashboard-card-name" title={project.name}>
              {project.name}
            </span>

            <div className="dashboard-card-meta">
              <OnlineAvatars users={project.onlineUsers} />
              <span className="dashboard-card-date">
                {formatRelativeDate(project.lastOpenedAt)}
              </span>
            </div>

            <div className="dashboard-card-actions">
              <ProjectMenu
                project={project}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- shared sub-components ----

function ProjectMenu({
  project,
  onOpen,
  onRename,
  onDelete,
}: {
  project: Project
  onOpen: (p: Project) => void
  onRename: (p: Project) => void
  onDelete: (p: Project) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="dashboard-row-menu"
          aria-label="Project actions"
        >
          <EllipsisVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onClick={() => onOpen(project)}>
          <FolderOpen className="size-4" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRename(project)}>
          <Pencil className="size-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(project)}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OnlineAvatars({ users }: { users: ProjectUser[] }) {
  if (users.length === 0) {
    return <span className="dashboard-online-empty">--</span>
  }

  return (
    <div className="dashboard-avatar-stack">
      {users.slice(0, 4).map((user) => (
        <div key={user.id} className="dashboard-avatar" title={user.name}>
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {users.length > 4 && (
        <span className="dashboard-avatar-overflow">
          +{users.length - 4}
        </span>
      )}
    </div>
  )
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}
