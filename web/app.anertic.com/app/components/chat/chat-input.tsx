import { useCallback, useRef, useEffect } from 'react'
import { RiArrowUpLine, RiStopFill } from '@remixicon/react'
import { cn } from '~/lib/utils'
import { ScrollArea, ScrollBar } from '~/components/ui/scroll-area'
import type { SparkSuggestion } from '~/lib/spark'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  suggestions?: SparkSuggestion[]
  bordered?: boolean
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  suggestions,
  bordered = true,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Take first 4 suggestions deterministically (no Math.random to avoid SSR hydration mismatch)
  const visibleSuggestions = suggestions?.slice(0, 4)

  const handleSubmit = useCallback(() => {
    const value = textareaRef.current?.value.trim()
    if (!value || isStreaming) return
    onSend(value)
    if (textareaRef.current) {
      textareaRef.current.value = ''
      textareaRef.current.style.height = 'auto'
    }
  }, [onSend, isStreaming])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus()
    }
  }, [isStreaming])

  return (
    <div className={cn("safe-area-pb relative", bordered && "border-t")}>
      {/* Fade mask — messages dissolve behind input */}
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background to-transparent" />
      <div className="bg-background px-3 pb-3 pt-2 md:px-4 md:pb-4">
      {visibleSuggestions && visibleSuggestions.length > 0 && !isStreaming && (
        <ScrollArea className="mx-auto mb-2 max-w-3xl">
          <div className="flex gap-1.5 pb-2">
            {visibleSuggestions.map((s) => (
              <button
                key={s.text}
                onClick={() => onSend(s.text)}
                className="inline-flex shrink-0 items-center rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97]"
              >
                {s.text}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl bg-muted/40 px-3 py-2.5 ring-1 ring-border/50 transition-shadow focus-within:ring-border focus-within:shadow-sm md:px-4 md:py-3">
        <textarea
          ref={textareaRef}
          name="message"
          rows={2}
          placeholder="Ask about your energy…"
          className="flex-1 resize-none bg-transparent text-base leading-relaxed outline-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground"
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          aria-label="Message input"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg md:size-9',
              'bg-destructive text-white transition-colors',
              'hover:bg-destructive/90'
            )}
            aria-label="Stop generating"
          >
            <RiStopFill className="size-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg md:size-9',
              'bg-primary text-primary-foreground transition-colors',
              'hover:bg-primary/90',
              'disabled:opacity-50'
            )}
            disabled={disabled}
            aria-label="Send message"
          >
            <RiArrowUpLine className="size-4" />
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
