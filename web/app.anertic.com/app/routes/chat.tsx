import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import useSWR from 'swr'
import { RiMenuLine } from '@remixicon/react'
import { toast } from 'sonner'

import { useSiteId } from '~/layouts/site'
import { chatFetcher } from '~/lib/chat-api'
import { useChat } from '~/components/chat/use-chat'
import type { ChatMessage } from '~/components/chat/use-chat'
import { ChatInput } from '~/components/chat/chat-input'
import { MessageList } from '~/components/chat/message-list'
import { SuggestedPrompts } from '~/components/chat/suggested-prompts'
import { SPARK_SUGGESTIONS } from '~/lib/spark'
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
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    send,
    stop,
    isStreaming,
    conversationId,
    setConversationId,
    setMessages,
    messages,
  } = chat

  // Track whether initial restore is done to prevent empty-state flash
  const [initialized, setInitialized] = useState(
    () => !searchParams.get('conversation')
  )

  // Restore conversation from URL on mount
  useEffect(() => {
    const urlConversationId = searchParams.get('conversation')
    if (urlConversationId && urlConversationId !== conversationId) {
      handleSelectConversation(urlConversationId).finally(() =>
        setInitialized(true)
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-send prompt from URL (e.g. from Spark launcher)
  const promptSentRef = useRef(false)
  useEffect(() => {
    const prompt = searchParams.get('prompt')
    if (prompt && !promptSentRef.current && messages.length === 0 && !isStreaming) {
      promptSentRef.current = true
      setSearchParams(
        (prev) => {
          prev.delete('prompt')
          return prev
        },
        { replace: true }
      )
      send(prompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync conversationId to URL (covers new conversations from SSE)
  useEffect(() => {
    if (!conversationId) return
    setSearchParams(
      (prev) => {
        if (prev.get('conversation') === conversationId) return prev
        prev.set('conversation', conversationId)
        return prev
      },
      { replace: true }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

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
        setSearchParams(
          (prev) => {
            prev.set('conversation', result.id)
            return prev
          },
          { replace: true }
        )
      } catch {
        toast.error('Failed to load conversation')
      }
    },
    [isStreaming, stop, setConversationId, setMessages, setSearchParams]
  )

  const handleNewConversation = useCallback(() => {
    if (isStreaming) stop()
    setConversationId(null)
    setMessages([])
    setSearchParams(
      (prev) => {
        prev.delete('conversation')
        return prev
      },
      { replace: true }
    )
  }, [isStreaming, stop, setConversationId, setMessages, setSearchParams])

  const isEmpty = initialized && messages.length === 0

  const { data: recentData } = useSWR<{
    items: { id: string; title: string; updatedAt: string }[]
  }>(isEmpty ? ['conversation.list', { siteId }] : null, chatFetcher)
  const recentChats = (recentData?.items || []).slice(0, 3)

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
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-8"
            aria-label="Toggle conversation history"
          >
            <RiMenuLine className="size-5 md:size-4" />
          </button>
          <span className="text-sm font-medium">Spark</span>
        </div>

        {isEmpty ? (
          /* Empty state — everything centered */
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <SuggestedPrompts
              onSelect={send}
              recentChats={recentChats}
              onSelectChat={handleSelectConversation}
            />
            <div className="w-full max-w-2xl">
              <ChatInput
                onSend={send}
                onStop={stop}
                isStreaming={isStreaming}
                bordered={false}
              />
            </div>
          </div>
        ) : (
          /* Active conversation — messages + input at bottom */
          <>
            <MessageList messages={messages} isStreaming={isStreaming} />
            <ChatInput
              onSend={send}
              onStop={stop}
              isStreaming={isStreaming}
              suggestions={SPARK_SUGGESTIONS}
            />
          </>
        )}
      </div>
    </div>
  )
}
