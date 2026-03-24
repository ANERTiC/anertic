interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void
}

const prompts = [
  {
    icon: '⚡',
    label: 'Energy',
    text: "How\u2019s my energy usage today?",
    color: 'text-primary',
  },
  {
    icon: '📊',
    label: 'Insights',
    text: 'Any anomalies this week?',
    color: 'text-emerald-600',
  },
  {
    icon: '🔌',
    label: 'Devices',
    text: 'Show device status',
    color: 'text-amber-600',
  },
  {
    icon: '🔋',
    label: 'Compare',
    text: 'Compare this month vs last month',
    color: 'text-blue-600',
  },
]

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-purple-600">
          <span className="text-xl text-white" aria-hidden="true">✦</span>
        </div>
        <h2 className="text-lg font-semibold [text-wrap:balance]">Spark Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Ask about your energy, devices, or insights
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.text}
            onClick={() => onSelect(prompt.text)}
            className="min-h-11 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.98]"
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
