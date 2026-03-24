import { SPARK_SUGGESTIONS } from '~/lib/spark'

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
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
      <div className="grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4">
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
    </div>
  )
}
