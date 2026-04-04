import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { LoaderCircle } from "lucide-react"

import { Button } from "@/modules/Canvas/components/ui/button"
import { useProjects } from "@/lib/projects"

export function InviteAcceptPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { joinProject } = useProjects()
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (!projectId) {
      navigate("/", { replace: true })
      return
    }

    let isActive = true

    async function acceptInvite() {
      try {
        await joinProject(projectId!)
        if (isActive) {
          navigate(`/project/${projectId}`, { replace: true })
        }
      } catch {
        if (isActive) {
          setError("Failed to accept invite")
        }
      }
    }

    void acceptInvite()

    return () => {
      isActive = false
    }
  }, [joinProject, navigate, projectId])

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 bg-background">
      {error ? (
        <>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Back to projects
          </Button>
        </>
      ) : (
        <>
          <LoaderCircle className="size-8 animate-spin text-lime-400" />
          <p className="text-sm text-muted-foreground">Accepting invite...</p>
        </>
      )}
    </div>
  )
}
