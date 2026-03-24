/** Spark AI assistant configuration */

export interface SparkSuggestion {
  icon: string
  label: string
  text: string
  color: string
}

export const SPARK_SUGGESTIONS: SparkSuggestion[] = [
  {
    icon: '⚡',
    label: 'Energy',
    text: 'How\u2019s my energy usage today?',
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
    text: 'Show all my device status',
    color: 'text-amber-600',
  },
  {
    icon: '🔋',
    label: 'Compare',
    text: 'Compare this month vs last month',
    color: 'text-blue-600',
  },
  {
    icon: '🚗',
    label: 'Chargers',
    text: 'What\u2019s the status of my EV chargers?',
    color: 'text-violet-600',
  },
  {
    icon: '🏢',
    label: 'Rooms',
    text: 'Which room uses the most energy?',
    color: 'text-rose-600',
  },
  {
    icon: '📈',
    label: 'Peak hours',
    text: 'When is my peak energy usage?',
    color: 'text-orange-600',
  },
  {
    icon: '💡',
    label: 'Savings',
    text: 'How can I reduce my energy cost?',
    color: 'text-teal-600',
  },
]
