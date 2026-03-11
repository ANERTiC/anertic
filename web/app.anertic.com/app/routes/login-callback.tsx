import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { setTokens, setUser } from "~/lib/auth"
import { api } from "~/lib/api"
import type { User } from "~/lib/auth"

export default function LoginCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get("token")
    const refreshToken = searchParams.get("refresh_token")

    if (!token || !refreshToken) {
      navigate("/login", { replace: true })
      return
    }

    setTokens(token, refreshToken)

    // Fetch user info with the new token
    api<User>("auth.me")
      .then((user) => {
        setUser(user)
        navigate("/", { replace: true })
      })
      .catch(() => {
        navigate("/login", { replace: true })
      })
  }, [searchParams, navigate])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing in...</p>
    </div>
  )
}
