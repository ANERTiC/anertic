import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import useSWR from 'swr'
import {
  RiSparklingLine,
  RiArrowRightLine,
  RiChat1Line,
  RiCommandLine,
} from '@remixicon/react'
import { fetcher } from '~/lib/api'
import { SPARK_SUGGESTIONS } from '~/lib/spark'

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

const QUICK_SUGGESTIONS = SPARK_SUGGESTIONS.slice(0, 4)

export function SparkLauncher({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data } = useSWR<{ items: Conversation[] }>(
    open ? ['conversation.list', { siteId }] : null,
    fetcher
  )
  const recentChats = data?.items?.slice(0, 3) || []

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [open])

  const goToChat = useCallback(
    (prompt?: string) => {
      const params = new URLSearchParams({ site: siteId })
      if (prompt) params.set('prompt', prompt)
      navigate(`/chat?${params.toString()}`)
      setOpen(false)
    },
    [siteId, navigate]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) {
      goToChat()
      return
    }
    goToChat(query.trim())
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] motion-safe:animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Floating container */}
      <div className="fixed right-5 bottom-5 z-50" ref={panelRef}>
        {/* Popup panel */}
        {open && (
          <div className="absolute right-0 bottom-16 w-80 origin-bottom-right motion-safe:animate-scale-fade-in sm:w-96">
            <div className="overflow-hidden rounded-2xl border border-purple-200/40 bg-white/95 shadow-2xl shadow-purple-500/10 ring-1 ring-black/5 backdrop-blur-xl dark:border-purple-800/30 dark:bg-zinc-900/95 dark:shadow-purple-500/20">
              {/* Header */}
              <div className="relative overflow-hidden border-b border-purple-100/60 px-4 py-3 dark:border-purple-900/40">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.06] via-purple-500/[0.04] to-fuchsia-500/[0.06]" />
                <div className="relative flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-sm shadow-purple-500/25">
                    <span className="text-xs text-white" aria-hidden="true">
                      ✦
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight text-foreground">
                      Spark
                    </p>
                    <p className="text-[10px] leading-none text-muted-foreground">
                      AI energy assistant
                    </p>
                  </div>
                  <kbd className="ml-auto flex items-center gap-0.5 rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    <RiCommandLine className="size-2.5" aria-hidden="true" />K
                  </kbd>
                </div>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="px-3 pt-3 pb-2">
                <div className="group flex items-center gap-2 rounded-xl border border-purple-200/50 bg-muted/30 px-3 py-2 transition-colors focus-within:border-purple-400/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-500/15 dark:border-purple-800/40 dark:focus-within:bg-zinc-800">
                  <RiSparklingLine
                    className="size-4 shrink-0 text-purple-400"
                    aria-hidden="true"
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about your energy\u2026"
                    className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                  />
                  <button
                    type="submit"
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                    aria-label="Send"
                  >
                    <RiArrowRightLine className="size-3.5" />
                  </button>
                </div>
              </form>

              {/* Quick suggestions */}
              <div className="px-3 pb-2">
                <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Suggestions
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {QUICK_SUGGESTIONS.map((s, i) => (
                    <button
                      key={s.text}
                      onClick={() => goToChat(s.text)}
                      style={{ animationDelay: `${80 + i * 50}ms` }}
                      className="flex items-start gap-1.5 rounded-lg border border-transparent bg-muted/40 px-2.5 py-2 text-left transition-all hover:border-purple-200/50 hover:bg-purple-50/50 active:scale-[0.98] motion-safe:animate-fade-in-up dark:hover:border-purple-800/40 dark:hover:bg-purple-950/30"
                    >
                      <span className="mt-px text-xs leading-none" aria-hidden="true">
                        {s.icon}
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[10px] font-semibold ${s.color}`}>
                          {s.label}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {s.text}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent chats */}
              {recentChats.length > 0 && (
                <div className="border-t border-purple-100/40 px-3 py-2 dark:border-purple-900/30">
                  <p className="mb-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Recent
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentChats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          navigate(
                            `/chat?site=${siteId}&conversation=${chat.id}`
                          )
                          setOpen(false)
                        }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                      >
                        <RiChat1Line
                          className="size-3 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1 truncate text-xs text-foreground/80">
                          {chat.title || 'New conversation'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-purple-100/40 dark:border-purple-900/30">
                <button
                  onClick={() => goToChat()}
                  className="flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-purple-600 transition-colors hover:bg-purple-50/60 dark:text-purple-400 dark:hover:bg-purple-950/30"
                >
                  Open full chat
                  <RiArrowRightLine className="size-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Open Spark assistant"
          aria-expanded={open}
          className="group relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-purple-500/40 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95"
        >
          {/* Glow ring */}
          <span
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-400 opacity-0 blur-md transition-opacity group-hover:opacity-50 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <RiSparklingLine className="relative size-5" />
          {/* Online indicator */}
          <span className="absolute -top-0.5 -right-0.5 flex size-3" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-3 rounded-full border-2 border-white bg-emerald-500" />
          </span>
        </button>
      </div>
    </>
  )
}
