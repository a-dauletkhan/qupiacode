import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Mail } from "lucide-react"

import { AuthError, useAuth } from "@/lib/auth"
import { Button } from "@/modules/Canvas/components/ui/button"
import { Input } from "@/modules/Canvas/components/ui/input"
import { Label } from "@/modules/Canvas/components/ui/label"

import "./auth-page.css"

type AuthMode = "login" | "signup"

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate()
  const { login, signup } = useAuth()

  const [showEmail, setShowEmail] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const isLogin = mode === "login"

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (!email.trim()) {
      setError("Email is required")
      return
    }

    if (!password.trim()) {
      setError("Password is required")
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await login(email.trim(), password)
      } else {
        await signup(email.trim(), password)
      }
      navigate("/")
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        setError(err.message)
      } else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* ---- Left: form panel ---- */}
        <div className="auth-form-panel">
          <div className="auth-form-inner">
            {/* Logo + heading */}
            <div className="auth-heading">
              <span className="auth-logo">
                <QupiaBrand />
              </span>
              <div className="auth-heading-text">
                <h1 className="auth-title">
                  {isLogin ? "Welcome back" : "Welcome to Qupia"}
                </h1>
                <p className="auth-subtitle">
                  {isLogin
                    ? "Sign in to continue to your projects"
                    : "Sign up and start collaborating for free"}
                </p>
              </div>
            </div>

            {/* OAuth buttons */}
            {!showEmail && (
              <div className="auth-buttons">
                <div className="auth-oauth-group">
                  <button type="button" className="auth-oauth-btn">
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <button type="button" className="auth-oauth-btn">
                    <AppleIcon />
                    Continue with Apple
                  </button>
                  <button type="button" className="auth-oauth-btn">
                    <MicrosoftIcon />
                    Continue with Microsoft
                  </button>
                </div>

                <div className="auth-divider">
                  <span>OR</span>
                </div>

                <button
                  type="button"
                  className="auth-oauth-btn"
                  onClick={() => setShowEmail(true)}
                >
                  <Mail className="size-5" />
                  Continue with Email
                </button>
              </div>
            )}

            {/* Email form */}
            {showEmail && (
              <form onSubmit={handleSubmit} className="auth-email-form">
                <div className="auth-field">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="auth-field">
                  <Label htmlFor="auth-password">Password</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {error && <p className="auth-error">{error}</p>}
                <Button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading
                    ? "Please wait..."
                    : isLogin
                      ? "Sign in"
                      : "Create account"}
                </Button>
                <button
                  type="button"
                  className="auth-back-link"
                  onClick={() => setShowEmail(false)}
                  disabled={loading}
                >
                  All sign in options
                </button>
              </form>
            )}

            {/* Switch mode link */}
            <div className="auth-switch">
              {isLogin ? (
                <p>
                  Don't have an account?{" "}
                  <Link to="/signup" className="auth-switch-link">
                    Sign up
                  </Link>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <Link to="/login" className="auth-switch-link">
                    Sign in
                  </Link>
                </p>
              )}
            </div>

            {/* Legal footer */}
            <p className="auth-legal">
              By continuing, I acknowledge the{" "}
              <a href="#" className="auth-legal-link">
                Privacy Policy
              </a>{" "}
              and agree to the{" "}
              <a href="#" className="auth-legal-link">
                Terms of Use
              </a>
              .
            </p>
          </div>
        </div>

        {/* ---- Right: showcase panel (xl only) ---- */}
        <div className="auth-showcase-panel">
          <div className="auth-showcase-inner">
            <div className="auth-showcase-bg" />
            <div className="auth-showcase-overlay" />
            <div className="auth-showcase-content">
              <div className="auth-showcase-badges">
                <span className="auth-badge auth-badge-primary">
                  Real-time Collaboration
                </span>
                <span className="auth-badge auth-badge-glass">
                  Multi-user Canvas
                </span>
                <span className="auth-badge auth-badge-glass">
                  Voice & Chat
                </span>
              </div>
              <div className="auth-showcase-text">
                <h2 className="auth-showcase-title">QUPIA CANVAS</h2>
                <p className="auth-showcase-desc">
                  Collaborate in real-time on an infinite canvas with voice
                  calls, chat, and powerful drawing tools
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Brand / OAuth icons ----

function QupiaBrand() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      className="text-primary"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="var(--primary-foreground)"
        fontFamily="var(--font-sans)"
      >
        Q
      </text>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path
        d="M18.8 10.209C18.8 9.559 18.742 8.934 18.633 8.334H10V11.88H14.933C14.721 13.026 14.075 13.997 13.104 14.647V16.947H16.067C17.8 15.351 18.8 13.001 18.8 10.209Z"
        fill="#4285F4"
      />
      <path
        d="M10 19.167C12.475 19.167 14.55 18.346 16.067 16.946L13.104 14.646C12.284 15.196 11.234 15.521 10 15.521C7.613 15.521 5.592 13.909 4.871 11.742H1.809V14.117C3.317 17.113 6.417 19.167 10 19.167Z"
        fill="#34A853"
      />
      <path
        d="M4.87 11.741C4.686 11.191 4.582 10.604 4.582 9.999C4.582 9.395 4.686 8.808 4.87 8.258V5.883H1.807C1.165 7.16 0.831 8.57 0.832 9.999C0.832 11.479 1.186 12.879 1.807 14.116L4.87 11.741Z"
        fill="#FBBC05"
      />
      <path
        d="M10 4.48C11.346 4.48 12.554 4.942 13.504 5.851L16.134 3.221C14.546 1.742 12.471 0.834 10 0.834C6.417 0.834 3.317 2.888 1.809 5.884L4.871 8.259C5.592 6.092 7.613 4.48 10 4.48Z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path
        d="M9.687 6.019C8.957 6.019 7.827 5.189 6.637 5.219C5.067 5.239 3.627 6.129 2.817 7.539C1.187 10.369 2.397 14.549 3.987 16.849C4.767 17.969 5.687 19.229 6.907 19.189C8.077 19.139 8.517 18.429 9.937 18.429C11.347 18.429 11.747 19.189 12.987 19.159C14.247 19.139 15.047 18.019 15.817 16.889C16.707 15.589 17.077 14.329 17.097 14.259C17.067 14.249 14.647 13.319 14.617 10.519C14.597 8.179 16.527 7.059 16.617 7.009C15.517 5.399 13.827 5.219 13.237 5.179C11.697 5.059 10.407 6.019 9.687 6.019ZM12.287 3.659C12.937 2.879 13.367 1.789 13.247 0.709C12.317 0.749 11.197 1.329 10.527 2.109C9.927 2.799 9.407 3.909 9.547 4.969C10.577 5.049 11.637 4.439 12.287 3.659Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M8.554 8.553H0V0H8.554V8.553Z" fill="#F1511B" />
      <path d="M18 8.553H9.445V0H18V8.553Z" fill="#80CC28" />
      <path d="M8.554 18H0V9.447H8.554V18Z" fill="#00ADEF" />
      <path d="M18 18H9.445V9.447H18V18Z" fill="#FBBC09" />
    </svg>
  )
}
