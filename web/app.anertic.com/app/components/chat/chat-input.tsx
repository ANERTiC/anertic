import { useCallback, useRef, useEffect } from 'react'
import { RiArrowUpLine, RiStopFill } from '@remixicon/react'
import { cn } from '~/lib/utils'

interface Suggestion {
  icon: string
  label: string
  text: string
}

interface ChatInputProps {
  onSend: (message: string) => void
  onStop: () => void
  isStreaming: boolean
  disabled?: boolean
  suggestions?: Suggestion[]
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  suggestions,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div className="safe-area-pb border-t bg-background p-3 md:p-4 motion-safe:animate-fade-in-up [animation-delay:200ms]">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-muted/50 px-3 py-2.5 md:px-4 md:py-3">
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
              'text-destructive-foreground bg-destructive transition-colors',
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
      {suggestions && suggestions.length > 0 && !isStreaming && (
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.text}
              onClick={() => onSend(s.text)}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97]"
            >
              <span aria-hidden="true">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
