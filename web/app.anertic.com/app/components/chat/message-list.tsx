import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './message-bubble'
import type { ChatMessage } from './use-chat'
import { cn } from '~/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  className?: string
  quickReplies?: string[]
  onQuickReply?: (text: string) => void
}

export function MessageList({ messages, isStreaming, className, quickReplies, onQuickReply }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  const [justFinishedId, setJustFinishedId] = useState<string | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    bottomRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  }, [messages, isStreaming])

  // Detect streaming → done transition
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
      if (lastAssistant) {
        setJustFinishedId(lastAssistant.id)
        const timer = setTimeout(() => setJustFinishedId(null), 700)
        return () => clearTimeout(timer)
      }
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, messages])

  return (
    <div
      className={cn("flex-1 overflow-y-auto px-3 py-4 pb-2 md:px-4 md:py-6 md:pb-2", className)}
      role="log"
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl space-y-3 md:space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            justFinished={msg.id === justFinishedId}
          />
        ))}
        {quickReplies && quickReplies.length > 0 && !isStreaming && (
          <div className="flex gap-2 pl-9.5 motion-safe:animate-fade-in-up">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => onQuickReply?.(reply)}
                className="rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
