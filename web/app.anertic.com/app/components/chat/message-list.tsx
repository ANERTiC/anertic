import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './message-bubble'
import type { ChatMessage } from './use-chat'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const wasStreamingRef = useRef(false)
  const [justFinishedId, setJustFinishedId] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6"
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
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
