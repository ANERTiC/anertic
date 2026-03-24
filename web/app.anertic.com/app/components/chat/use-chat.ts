import { useCallback, useRef, useState } from 'react'

export interface ThinkingStep {
  name: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinkingSteps?: ThinkingStep[]
}

interface SSEEvent {
  type: 'conversation_id' | 'text' | 'tool_use' | 'error' | 'done'
  content?: string
  name?: string
  status?: string
  error?: string
}

interface UseChatReturn {
  messages: ChatMessage[]
  send: (message: string) => void
  stop: () => void
  isStreaming: boolean
  conversationId: string | null
  setConversationId: (id: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
}

let messageIdCounter = 0
function nextId(): string {
  return `msg_${Date.now()}_${++messageIdCounter}`
}

export function useChat(siteId: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const conversationIdRef = useRef<string | null>(null)

  // Keep ref in sync
  conversationIdRef.current = conversationId

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const send = useCallback(
    async (message: string) => {
      if (isStreaming) return

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: message,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      const assistantId = nextId()
      let assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        thinkingSteps: [],
      }

      setMessages((prev) => [...prev, assistantMsg])

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            siteId,
            message,
          }),
          signal: controller.signal,
        })

        if (res.status === 401) {
          window.location.href = '/login'
          return
        }

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Failed to get response from AI.' }
                : m
            )
          )
          setIsStreaming(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const dataLine = line.trim()
            if (!dataLine.startsWith('data: ')) continue

            const jsonStr = dataLine.slice(6)
            let event: SSEEvent
            try {
              event = JSON.parse(jsonStr)
            } catch {
              continue
            }

            switch (event.type) {
              case 'conversation_id':
                if (event.content) {
                  setConversationId(event.content)
                  conversationIdRef.current = event.content
                }
                break

              case 'text':
                assistantMsg = {
                  ...assistantMsg,
                  content: assistantMsg.content + (event.content || ''),
                }
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? assistantMsg : m))
                )
                break

              case 'tool_use': {
                const steps = [...(assistantMsg.thinkingSteps || [])]
                if (event.status === 'running') {
                  steps.push({
                    name: event.name || 'Unknown tool',
                    status: 'running',
                  })
                } else {
                  let idx = -1
                  for (let i = steps.length - 1; i >= 0; i--) {
                    if (
                      steps[i].name === event.name &&
                      steps[i].status === 'running'
                    ) {
                      idx = i
                      break
                    }
                  }
                  if (idx >= 0) {
                    steps[idx] = {
                      ...steps[idx],
                      status: event.status === 'error' ? 'error' : 'done',
                      error: event.error,
                    }
                  }
                }
                assistantMsg = { ...assistantMsg, thinkingSteps: steps }
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? assistantMsg : m))
                )
                break
              }

              case 'error':
                assistantMsg = {
                  ...assistantMsg,
                  content:
                    assistantMsg.content +
                    `\n\n**Error:** ${event.error || event.content || 'Unknown error'}`,
                }
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? assistantMsg : m))
                )
                break

              case 'done':
                setIsStreaming(false)
                break
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          assistantMsg = {
            ...assistantMsg,
            content:
              assistantMsg.content || 'Connection lost. Please try again.',
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? assistantMsg : m))
          )
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, siteId]
  )

  return {
    messages,
    send,
    stop,
    isStreaming,
    conversationId,
    setConversationId,
    setMessages,
  }
}
