import { useState, useCallback } from 'react'
import { RiMenuLine } from '@remixicon/react'
import { toast } from 'sonner'

import { useSiteId } from '~/layouts/site'
import { chatFetcher } from '~/lib/chat-api'
import { useChat } from '~/components/chat/use-chat'
import type { ChatMessage } from '~/components/chat/use-chat'
import { ChatInput } from '~/components/chat/chat-input'
import { MessageList } from '~/components/chat/message-list'
import { SuggestedPrompts } from '~/components/chat/suggested-prompts'
import { ConversationSidebar } from '~/components/chat/conversation-sidebar'

interface RawMessage {
  id: string
  role: string
  content: string
  toolName: string
  toolCallId: string
  createdAt: string
}

function reconstructMessages(raw: RawMessage[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  let currentAssistant: ChatMessage | null = null

  for (const msg of raw) {
    if (msg.role === 'user') {
      if (currentAssistant) {
        messages.push(currentAssistant)
        currentAssistant = null
      }
      messages.push({ id: msg.id, role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      if (currentAssistant) {
        messages.push(currentAssistant)
      }
      currentAssistant = {
        id: msg.id,
        role: 'assistant',
        content: msg.content,
        thinkingSteps: [],
      }
    } else if (msg.role === 'tool_call') {
      if (currentAssistant) {
        currentAssistant.thinkingSteps = [
          ...(currentAssistant.thinkingSteps || []),
          { name: msg.toolName, status: 'running' },
        ]
      }
    } else if (msg.role === 'tool_result') {
      if (currentAssistant) {
        const steps = currentAssistant.thinkingSteps || []
        let idx = -1
        for (let i = steps.length - 1; i >= 0; i--) {
          if (steps[i].status === 'running') {
            idx = i
            break
          }
        }
        if (idx >= 0) {
          steps[idx] = { ...steps[idx], status: 'done' }
          currentAssistant.thinkingSteps = [...steps]
        }
      }
    }
  }
  if (currentAssistant) messages.push(currentAssistant)

  return messages
}

export default function ChatPage() {
  const siteId = useSiteId()
  const chat = useChat(siteId)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    send,
    stop,
    isStreaming,
    conversationId,
    setConversationId,
    setMessages,
    messages,
  } = chat

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (isStreaming) stop()
      try {
        const result = await chatFetcher<{
          id: string
          messages: RawMessage[]
        }>(['conversation.get', { id }])
        setConversationId(result.id)
        setMessages(reconstructMessages(result.messages))
      } catch {
        toast.error('Failed to load conversation')
      }
    },
    [isStreaming, stop, setConversationId, setMessages]
  )

  const handleNewConversation = useCallback(() => {
    if (isStreaming) stop()
    setConversationId(null)
    setMessages([])
  }, [isStreaming, stop, setConversationId, setMessages])

  const isEmpty = messages.length === 0

  return (
    <div className="-m-6 flex h-[calc(100dvh-3rem)]">
      <ConversationSidebar
        siteId={siteId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={conversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
      />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Toggle conversation history"
          >
            <RiMenuLine className="size-4" />
          </button>
          <span className="text-sm font-medium">AI Assistant</span>
        </div>

        {/* Messages or empty state */}
        {isEmpty ? (
          <SuggestedPrompts onSelect={send} />
        ) : (
          <MessageList messages={messages} isStreaming={isStreaming} />
        )}

        {/* Input */}
        <ChatInput onSend={send} onStop={stop} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
