import useSWR from 'swr'
import {
  RiAddLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiChat1Line,
} from '@remixicon/react'
import { chatFetcher } from '~/lib/chat-api'
import { cn } from '~/lib/utils'
import { useIsMobile } from '~/hooks/use-mobile'
import { Sheet, SheetContent } from '~/components/ui/sheet'

interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface ConversationSidebarProps {
  siteId: string
  open: boolean
  onClose: () => void
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function SidebarContent_({
  siteId,
  activeId,
  onSelect,
  onNew,
  onClose,
}: Omit<ConversationSidebarProps, 'open'>) {
  const { data, mutate } = useSWR<{ items: Conversation[] }>(
    ['conversation.list', { siteId }],
    chatFetcher
  )
  const conversations = data?.items || []

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    await chatFetcher(['conversation.delete', { id }])
    mutate()
  }

  return (
    <div className="flex h-full w-60 flex-col border-r bg-background motion-safe:animate-slide-in-left">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-sm font-semibold">Conversations</span>
        <div className="flex gap-1">
          <button
            onClick={onNew}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="New conversation"
          >
            <RiAddLine className="size-4" />
          </button>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close sidebar"
          >
            <RiCloseLine className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <RiChat1Line className="size-8 opacity-30" />
            No conversations yet
          </div>
        ) : (
          conversations.map((conv, i) => (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(conv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(conv.id)
                }
              }}
              style={{ animationDelay: `${i * 40}ms` }}
              className={cn(
                'group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:animate-fade-in-up',
                activeId === conv.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <div className="flex-1 overflow-hidden">
                <div className="truncate text-xs font-medium">
                  {conv.title || 'New conversation'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(conv.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="hidden size-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex group-focus-within:flex focus-visible:flex focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Delete conversation: ${conv.title}`}
              >
                <RiDeleteBinLine className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const isMobile = useIsMobile()

  if (!props.open) return null

  if (isMobile) {
    return (
      <Sheet
        open={props.open}
        onOpenChange={(open) => !open && props.onClose()}
      >
        <SheetContent side="left" className="w-60 p-0">
          <SidebarContent_ {...props} />
        </SheetContent>
      </Sheet>
    )
  }

  return <SidebarContent_ {...props} />
}
