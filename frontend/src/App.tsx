import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"

import { AuthPage } from "@/components/auth/auth-page"
import { InviteAcceptPage } from "@/components/invite/invite-accept-page"
import { PrivacyPage, TermsPage } from "@/components/legal/legal-page"
import { CanvasWorkspace } from "@/modules/Canvas/components/canvas/canvas-workspace"
import { ProjectsDashboard } from "@/components/projects/projects-dashboard"
import { useAuth } from "@/lib/auth"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }

  return children
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const from =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/"

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return children
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <AuthPage mode="login" />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <AuthPage mode="signup" />
            </GuestRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ProjectsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/project/:projectId"
          element={
            <ProtectedRoute>
              <CanvasWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invite/:projectId"
          element={
            <ProtectedRoute>
              <InviteAcceptPage />
            </ProtectedRoute>
          }
        />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
