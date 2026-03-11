import { useNavigate } from "react-router"
import { RiGoogleFill } from "@remixicon/react"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { setAuth } from "~/lib/auth"

export default function Login() {
  const navigate = useNavigate()

  function handleGoogleSignIn() {
    // TODO: Replace with real Google OAuth flow
    // For now, redirect to backend OAuth endpoint
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080"
    window.location.href = `${apiUrl}/auth/google`
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
          A
        </div>
        <CardTitle className="text-xl">Welcome to ANERTiC</CardTitle>
        <CardDescription>
          AI-powered energy monitoring platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full gap-2"
          size="lg"
          onClick={handleGoogleSignIn}
        >
          <RiGoogleFill className="size-4" />
          Sign in with Google
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardContent>
    </Card>
  )
}
