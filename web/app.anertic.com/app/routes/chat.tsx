import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import useSWR from 'swr'
import {
  RiHistoryLine,
  RiEditLine,
  RiDeleteBinLine,
} from '@remixicon/react'
import { toast } from 'sonner'
import { cn } from '~/lib/utils'
import { Skeleton } from '~/components/ui/skeleton'

import { useSiteId } from '~/layouts/site'
import { chatFetcher } from '~/lib/chat-api'
import { useChat } from '~/components/chat/use-chat'
import type { ChatMessage } from '~/components/chat/use-chat'
import { ChatInput } from '~/components/chat/chat-input'
import { MessageList } from '~/components/chat/message-list'
import { SuggestedPrompts } from '~/components/chat/suggested-prompts'
import { SPARK_SUGGESTIONS } from '~/lib/spark'
import { agenticApi } from '~/lib/agentic-api.server'
import type { Route } from './+types/chat'

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

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'always', style: 'narrow' })

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(dateStr))
}

interface ConversationItem {
  id: string
  title: string
  updatedAt: string
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const siteId = url.searchParams.get('site')
  if (!siteId) return { conversations: [] as ConversationItem[] }

  try {
    const { result } = await agenticApi<{ items: ConversationItem[] }>(
      request,
      'conversation.list',
      { siteId }
    )
    return { conversations: (result.items || []).slice(0, 5) }
  } catch {
    return { conversations: [] as ConversationItem[] }
  }
}

export default function ChatPage({ loaderData }: Route.ComponentProps) {
  const siteId = useSiteId()
  const chat = useChat(siteId)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyClosing, setHistoryClosing] = useState(false)
  const historyVisible = historyOpen || historyClosing
  const panelRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const closeHistory = useCallback(() => {
    setHistoryOpen(false)
    setHistoryClosing(true)
    setTimeout(() => setHistoryClosing(false), 150)
  }, [])

  const {
    send,
    stop,
    isStreaming,
    conversationId,
    setConversationId,
    setMessages,
    messages,
    quickReplies,
  } = chat

  // Track whether initial restore is done to prevent empty-state flash
  const [initialized, setInitialized] = useState(
    () => !searchParams.get('conversation')
  )
  const [isRestoring, setIsRestoring] = useState(
    () => !!searchParams.get('conversation')
  )

  // Restore conversation from URL on mount
  useEffect(() => {
    const urlConversationId = searchParams.get('conversation')
    if (urlConversationId && urlConversationId !== conversationId) {
      setIsRestoring(true)
      handleSelectConversation(urlConversationId).finally(() => {
        setInitialized(true)
        setIsRestoring(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-send prompt from URL (e.g. from Spark launcher)
  const promptSentRef = useRef(false)
  useEffect(() => {
    const prompt = searchParams.get('prompt')
    if (
      prompt &&
      !promptSentRef.current &&
      messages.length === 0 &&
      !isStreaming
    ) {
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

  // Close history panel on outside click
  useEffect(() => {
    if (!historyOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeHistory()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [historyOpen, closeHistory])

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (isStreaming) stop()
      closeHistory()
      setIsRestoring(true)
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
      } finally {
        setIsRestoring(false)
      }
    },
    [isStreaming, stop, closeHistory, setConversationId, setMessages, setSearchParams]
  )

  const handleNewConversation = useCallback(() => {
    if (isStreaming) stop()
    setConversationId(null)
    setMessages([])
    closeHistory()
    setSearchParams(
      (prev) => {
        prev.delete('conversation')
        return prev
      },
      { replace: true }
    )
  }, [isStreaming, stop, closeHistory, setConversationId, setMessages, setSearchParams])

  // Conversation list from server loader, with SWR for client-side revalidation
  const { data: historyData, mutate: mutateHistory } = useSWR<{
    items: ConversationItem[]
  }>(
    ['conversation.list', { siteId }],
    chatFetcher,
    { fallbackData: { items: loaderData.conversations } }
  )
  const conversations = (historyData?.items || []).slice(0, 5)

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    await chatFetcher(['conversation.delete', { id }])
    mutateHistory()
    if (conversationId === id) handleNewConversation()
  }

  const isEmpty = initialized && messages.length === 0
  const recentChats = conversations.slice(0, 3)

  return (
    <div className="-m-6 relative h-[calc(100dvh-3rem)]">
      <div className="flex h-full flex-col overflow-hidden">
        {/* Top bar */}
        <div className="relative flex items-center px-2 pt-2 pb-1" ref={panelRef}>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => (historyOpen ? closeHistory() : setHistoryOpen(true))}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg transition-colors',
                historyVisible
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              aria-label="Conversation history"
            >
              <RiHistoryLine className="size-[18px]" />
            </button>
            <button
              onClick={handleNewConversation}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="New conversation"
            >
              <RiEditLine className="size-[18px]" />
            </button>
          </div>

          {/* History dropdown */}
          {historyVisible && (
            <div className={cn(
              "absolute left-2 top-full z-40 mt-1 min-w-56 max-w-80 rounded-xl bg-background p-1 shadow-lg ring-1 ring-border/30",
              historyClosing ? "motion-safe:animate-fade-out-down" : "motion-safe:animate-fade-in-up"
            )}>
              {conversations.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                  No conversations yet
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                      conversationId === conv.id
                        ? 'bg-primary/8 text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <button
                      onClick={() => handleSelectConversation(conv.id)}
                      className="absolute inset-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={conv.title || 'Untitled'}
                    />
                    <span className="pointer-events-none relative min-w-0 flex-1 truncate text-[13px]">
                      {conv.title || 'Untitled'}
                    </span>
                    <span className="pointer-events-none relative shrink-0 text-[10px] tabular-nums text-muted-foreground/40 group-hover:hidden">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="relative z-10 hidden shrink-0 rounded-md p-1 text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover:block"
                      aria-label={`Delete ${conv.title || 'conversation'}`}
                    >
                      <RiDeleteBinLine className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {isRestoring ? (
          /* Skeleton while loading a conversation */
          <div className="flex-1 overflow-hidden px-3 py-4 md:px-4 md:py-6">
            <div className="mx-auto max-w-3xl space-y-4">
              {/* User bubble skeleton */}
              <div className="flex justify-end">
                <Skeleton className="h-10 w-48 rounded-2xl rounded-br-sm" />
              </div>
              {/* Assistant bubble skeleton */}
              <div className="flex gap-2.5">
                <Skeleton className="size-7 shrink-0 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              {/* User bubble skeleton */}
              <div className="flex justify-end">
                <Skeleton className="h-10 w-36 rounded-2xl rounded-br-sm" />
              </div>
              {/* Assistant bubble skeleton */}
              <div className="flex gap-2.5">
                <Skeleton className="size-7 shrink-0 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-72" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </div>
          </div>
        ) : isEmpty ? (
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
            <MessageList messages={messages} isStreaming={isStreaming} quickReplies={quickReplies} onQuickReply={send} />
            <ChatInput
              onSend={send}
              onStop={stop}
              isStreaming={isStreaming}
              bordered={false}
              suggestions={SPARK_SUGGESTIONS}
            />
          </>
        )}
      </div>
    </div>
  )
}
