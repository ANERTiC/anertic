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
import './app.css'

export const meta: Route.MetaFunction = () => [
  { title: 'ANERTiC — AI-Powered Energy Platform' },
  { name: 'description', content: 'Know your energy. Optimize your future.' },
]

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
    pulseClass: string
  }
> = {
  'not-found': {
    icon: RiCompassDiscoverLine,
    code: '404',
    title: 'Route not found',
    description: 'This endpoint is not connected to any node in the system.',
    accentClass: 'text-amber-500',
    pulseClass: 'bg-amber-500',
  },
  network: {
    icon: RiSignalWifiOffLine,
    code: 'CONN_LOST',
    title: 'Connection lost',
    description:
      'Unable to reach the backend service. The system may be restarting or under maintenance.',
    accentClass: 'text-destructive',
    pulseClass: 'bg-destructive',
  },
  fault: {
    icon: RiAlertLine,
    code: 'SYS_FAULT',
    title: 'System fault',
    description: 'An unexpected error interrupted the current operation.',
    accentClass: 'text-destructive',
    pulseClass: 'bg-destructive',
  },
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const variant = getErrorVariant(error)
  const config = ERROR_CONFIG[variant]
  const Icon = config.icon

  let statusCode: number | undefined
  let rawMessage: string | undefined
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    statusCode = error.status
    rawMessage = error.statusText
  } else if (error instanceof Error) {
    rawMessage = error.message
    if (import.meta.env.DEV) {
      stack = error.stack
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Circuit grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial fade from center */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,var(--background)_70%)]" />

      <div className="relative z-10 mx-auto w-full max-w-md px-6">
        {/* Status indicator */}
        <div className="mb-8 flex items-center gap-3">
          <div className="relative flex size-3">
            <span
              className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${config.pulseClass}`}
            />
            <span
              className={`relative inline-flex size-3 rounded-full ${config.pulseClass}`}
            />
          </div>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            {config.code}
          </span>
        </div>

        {/* Icon */}
        <div className="mb-6">
          <div
            className={`inline-flex size-12 items-center justify-center rounded-xl border border-border/60 bg-muted/50 ${config.accentClass}`}
          >
            <Icon className="size-5" />
          </div>
        </div>

        {/* Title + description */}
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-foreground">
          {config.title}
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          {config.description}
        </p>

        {/* Raw error detail (non-dev: only if useful) */}
        {rawMessage && rawMessage !== config.description && (
          <div className="mb-8 rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Detail
            </div>
            <p className="font-mono text-xs leading-relaxed text-foreground/80 break-all">
              {rawMessage}
            </p>
          </div>
        )}

        {/* Dev stack trace */}
        {stack && (
          <details className="mb-8 group">
            <summary className="mb-2 cursor-pointer font-mono text-[10px] tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors">
              Stack trace
            </summary>
            <pre className="max-h-48 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-5 text-foreground/70">
              {stack}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {variant === 'network' ? (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <RiRefreshLine className="size-4" />
              Retry connection
            </button>
          ) : (
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
            >
              <RiArrowLeftLine className="size-4" />
              Back to dashboard
            </a>
          )}
          {variant !== 'network' && (
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <RiRefreshLine className="size-4" />
              Reload
            </button>
          )}
        </div>

        {/* Brand footer */}
        <div className="mt-16 flex items-center gap-1.5 text-muted-foreground/40">
          <RiFlashlightLine className="size-3.5" />
          <span className="text-[11px] font-medium tracking-wide">ANERTiC</span>
        </div>
      </div>
    </main>
  )
}
