import { RiGoogleFill, RiFlashlightLine } from '@remixicon/react'
import { Button } from '~/components/ui/button'
import type { Route } from './+types/login'

export async function loader({}: Route.LoaderArgs) {
  const authUrl = process.env.AUTH_URL || 'http://localhost:8080/auth/google'
  const authCallbackUrl =
    process.env.AUTH_CALLBACK_URL || 'http://localhost:5173/login/callback'
  return { authUrl, authCallbackUrl }
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { authUrl, authCallbackUrl } = loaderData

  function handleGoogleSignIn() {
    window.location.href = `${authUrl}?redirect_url=${encodeURIComponent(authCallbackUrl)}`
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <RiFlashlightLine className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ANERTiC</h1>
        <p className="text-center text-sm text-muted-foreground">
          AI-Powered Energy Platform. Know your energy. Optimize your future.
        </p>
      </div>

      <div className="w-full space-y-4">
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-2.5"
          onClick={handleGoogleSignIn}
        >
          <RiGoogleFill className="size-4" />
          Continue with Google
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
