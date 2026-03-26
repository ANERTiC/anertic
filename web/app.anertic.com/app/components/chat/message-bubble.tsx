import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '~/lib/utils'
import { ThinkingSteps } from './thinking-steps'
import type { ChatMessage } from './use-chat'

interface MessageBubbleProps {
  message: ChatMessage
  justFinished?: boolean
}

export function MessageBubble({ message, justFinished }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end motion-safe:animate-message-in">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground md:max-w-[75%] md:text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  const hasSteps =
    message.thinkingSteps && message.thinkingSteps.length > 0

  return (
    <div className="motion-safe:animate-message-in">
      {/* Tool calls render above the response */}
      {hasSteps && <ThinkingSteps steps={message.thinkingSteps!} />}

      <div className="flex gap-2.5">
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-700',
            justFinished && 'motion-safe:animate-spark-complete'
          )}
        >
          <span className="text-xs text-white" aria-hidden="true">✦</span>
        </div>
        <div
          className={cn(
            'max-w-[90%] overflow-hidden rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm md:max-w-[80%] md:px-4',
            'prose prose-sm prose-neutral dark:prose-invert',
            '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3',
            '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
            '[&_table]:text-xs [&_td]:px-2 [&_th]:px-2',
            '[&_p]:leading-relaxed [&_p:last-child]:mb-0'
          )}
        >
          {message.content ? (
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          ) : (
            <div className="flex items-center gap-1 py-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/40 motion-safe:animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-muted-foreground/40 motion-safe:animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-muted-foreground/40 motion-safe:animate-bounce" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
