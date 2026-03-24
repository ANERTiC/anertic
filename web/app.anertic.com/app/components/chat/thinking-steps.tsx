import { useState } from 'react'
import { RiArrowRightSLine } from '@remixicon/react'
import { cn } from '~/lib/utils'
import type { ThinkingStep } from './use-chat'

interface ThinkingStepsProps {
  steps: ThinkingStep[]
}

export function ThinkingSteps({ steps }: ThinkingStepsProps) {
  const [expanded, setExpanded] = useState(false)

  if (steps.length === 0) return null

  const isRunning = steps.some((s) => s.status === 'running')
  const hasError = steps.some((s) => s.status === 'error')
  const doneCount = steps.filter((s) => s.status === 'done').length
  const label = isRunning
    ? steps.find((s) => s.status === 'running')?.name || 'Working\u2026'
    : hasError
      ? 'Completed with errors'
      : `Used ${doneCount} tool${doneCount !== 1 ? 's' : ''}`

  return (
    <div className="mb-1 ml-[38px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          isRunning
            ? 'border border-primary/20 bg-primary/5 text-primary'
            : hasError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
        aria-expanded={expanded}
        aria-label={`${label}, ${steps.length} step${steps.length !== 1 ? 's' : ''}`}
      >
        {isRunning && (
          <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
        )}
        <RiArrowRightSLine
          className={cn(
            'size-3.5 transition-transform duration-150',
            expanded && 'rotate-90'
          )}
        />
        <span>{label}</span>
        {!isRunning && (
          <span className="text-muted-foreground/60">
            {'\u00B7'} {steps.length} step{steps.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1 ml-2 space-y-0.5 border-l-2 border-muted pl-3">
          {steps.map((step, i) => (
            <div
              key={`${step.name}-${i}`}
              style={{ animationDelay: `${i * 30}ms` }}
              className="flex items-center gap-2 text-xs motion-safe:animate-fade-in-up"
            >
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  step.status === 'running' && 'bg-primary motion-safe:animate-pulse',
                  step.status === 'done' && 'bg-green-500',
                  step.status === 'error' && 'bg-destructive'
                )}
              />
              <span
                className={cn(
                  'font-mono text-[11px]',
                  step.status === 'error'
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                )}
              >
                {step.name}
              </span>
              {step.error && (
                <span className="text-destructive/70">{'\u2014'} {step.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
