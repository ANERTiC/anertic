import { RiChat1Line } from '@remixicon/react'
import { SPARK_SUGGESTIONS } from '~/lib/spark'

interface RecentChat {
  id: string
  title: string
  updatedAt: string
}

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
  recentChats?: RecentChat[]
  onSelectChat?: (id: string) => void
}

export function SuggestedPrompts({
  onSelect,
  recentChats,
  onSelectChat,
}: SuggestedPromptsProps) {
  return (
    <div className="flex flex-col items-center px-4 pb-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600 motion-safe:animate-scale-fade-in motion-safe:animate-shimmer-glow">
          <span className="text-xl text-white" aria-hidden="true">✦</span>
        </div>
        <h2 className="text-lg font-semibold [text-wrap:balance] motion-safe:animate-fade-in [animation-delay:150ms]">
          Spark Assistant
        </h2>
        <p className="text-sm text-muted-foreground motion-safe:animate-fade-in [animation-delay:250ms]">
          Ask about your energy, devices, or insights
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-2 gap-2 md:grid-cols-4">
        {SPARK_SUGGESTIONS.map((prompt, i) => (
          <button
            key={prompt.text}
            onClick={() => onSelect(prompt.text)}
            style={{ animationDelay: `${350 + i * 80}ms` }}
            className="min-h-11 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98] motion-safe:animate-fade-in-up"
          >
            <div className={`mb-1 text-xs font-semibold ${prompt.color}`}>
              {prompt.icon} {prompt.label}
            </div>
            <div className="text-xs text-muted-foreground">{prompt.text}</div>
          </button>
        ))}
      </div>

      {recentChats && recentChats.length > 0 && onSelectChat && (
        <div className="mt-6 w-full max-w-lg motion-safe:animate-fade-in [animation-delay:700ms]">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Recent conversations
          </p>
          <div className="flex flex-col gap-1">
            {recentChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className="flex min-h-10 items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <RiChat1Line
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">
                  {chat.title || 'New conversation'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
