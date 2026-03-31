import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router'

import type { Route } from './+types/root'
import { Toaster } from '~/components/ui/sonner'
import {
  RiSignalWifiOffLine,
  RiCompassDiscoverLine,
  RiAlertLine,
  RiArrowLeftLine,
  RiRefreshLine,
  RiFlashlightLine,
} from '@remixicon/react'
import { Button } from '~/components/ui/button'
import './app.css'

export const meta: Route.MetaFunction = () => [
  { title: 'ANERTiC — AI-Powered Energy Platform' },
  { name: 'description', content: 'Know your energy. Optimize your future.' },
]
export function headers(_: Route.HeadersArgs) {
  return {
    'Cache-Control': 'max-age=3600, s-maxage=86400',
  }
}
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-y-auto">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Toaster richColors />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('failed to fetch')
    )
  }
  return false
}

type ErrorVariant = 'not-found' | 'network' | 'fault'

function getErrorVariant(error: unknown): ErrorVariant {
  if (isRouteErrorResponse(error) && error.status === 404) return 'not-found'
  if (isNetworkError(error)) return 'network'
  return 'fault'
}

const ERROR_CONFIG: Record<
  ErrorVariant,
  {
    icon: typeof RiAlertLine
    code: string
    title: string
    description: string
    accentClass: string
    iconBgClass: string
    pulseClass: string
  }
> = {
  'not-found': {
    icon: RiCompassDiscoverLine,
    code: '404',
    title: 'Page not found',
    description: "The page you're looking for doesn't exist or has been moved.",
    accentClass: 'text-primary',
    iconBgClass:
      'bg-primary text-primary-foreground shadow-lg shadow-primary/25',
    pulseClass: 'bg-primary',
  },
  network: {
    icon: RiSignalWifiOffLine,
    code: 'OFFLINE',
    title: 'Connection lost',
    description:
      'Unable to reach the server. Check your connection or try again in a moment.',
    accentClass: 'text-destructive',
    iconBgClass: 'bg-destructive/10 text-destructive',
    pulseClass: 'bg-destructive',
  },
  fault: {
    icon: RiAlertLine,
    code: 'ERROR',
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
    accentClass: 'text-destructive',
    iconBgClass: 'bg-destructive/10 text-destructive',
    pulseClass: 'bg-destructive',
  },
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const variant = getErrorVariant(error)
  const config = ERROR_CONFIG[variant]
  const Icon = config.icon

  let rawMessage: string | undefined
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    rawMessage = error.statusText
  } else if (error instanceof Error) {
    rawMessage = error.message
    if (import.meta.env.DEV) {
      stack = error.stack
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        {/* Icon */}
        <div
          className={`flex size-14 items-center justify-center rounded-2xl ${config.iconBgClass}`}
        >
          <Icon className="size-7" />
        </div>

        {/* Status + title + description */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="mb-1 flex items-center gap-2">
            <span className="relative flex size-2">
              <span
                className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${config.pulseClass}`}
              />
              <span
                className={`relative inline-flex size-2 rounded-full ${config.pulseClass}`}
              />
            </span>
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
              {config.code}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>

        {/* Raw error detail */}
        {rawMessage && rawMessage !== config.description && (
          <div className="w-full rounded-lg border bg-muted/30 p-4">
            <p className="font-mono text-xs leading-relaxed break-all text-muted-foreground">
              {rawMessage}
            </p>
          </div>
        )}

        {/* Dev stack trace */}
        {stack && (
          <details className="group w-full">
            <summary className="mb-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Show stack trace
            </summary>
            <pre className="max-h-48 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
              {stack}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-2">
          {variant === 'network' ? (
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => window.location.reload()}
            >
              <RiRefreshLine className="size-4" />
              Retry connection
            </Button>
          ) : (
            <>
              <Button size="lg" className="w-full gap-2" asChild>
                <a href="/">
                  <RiArrowLeftLine className="size-4" />
                  Back to dashboard
                </a>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2"
                onClick={() => window.location.reload()}
              >
                <RiRefreshLine className="size-4" />
                Reload page
              </Button>
            </>
          )}
        </div>

        {/* Brand footer */}
        <p className="text-xs text-muted-foreground">
          <RiFlashlightLine className="mr-1 inline size-3.5 align-[-3px]" />
          ANERTiC
        </p>
      </div>
    </main>
  )
}
