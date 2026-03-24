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
    <div className="flex h-full w-56 flex-col rounded-2xl bg-background shadow-lg ring-1 ring-border/30 motion-safe:animate-slide-in-left">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          History
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={onNew}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background hover:text-foreground"
            aria-label="New conversation"
          >
            <RiAddLine className="size-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background hover:text-foreground"
            aria-label="Close sidebar"
          >
            <RiCloseLine className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto rounded-b-2xl px-2 py-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground/50">
            <RiChat1Line className="size-6" />
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
              style={{ animationDelay: `${i * 30}ms` }}
              className={cn(
                'group relative flex w-full cursor-pointer items-center rounded-lg px-2.5 py-2 text-left transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:animate-fade-in-up',
                activeId === conv.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate text-[13px] leading-tight font-medium">
                  {conv.title || 'New conversation'}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                  {formatRelativeTime(conv.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="absolute right-1.5 hidden size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex focus-visible:flex focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

  // Wait for hydration
  if (isMobile === undefined) return null

  if (isMobile) {
    return (
      <Sheet
        open={props.open}
        onOpenChange={(open) => !open && props.onClose()}
      >
        <SheetContent side="left" className="w-56 p-0">
          <SidebarContent_ {...props} />
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: floating panel with backdrop
  return (
    <>
      <div
        className="absolute inset-0 z-30 bg-black/10 motion-safe:animate-fade-in"
        onClick={props.onClose}
      />
      <div className="absolute left-2 top-2 bottom-2 z-40">
        <SidebarContent_ {...props} />
      </div>
    </>
  )
}
