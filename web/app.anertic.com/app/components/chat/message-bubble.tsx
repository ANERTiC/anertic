import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '~/lib/utils'
import { ThinkingSteps } from './thinking-steps'
import type { ChatMessage } from './use-chat'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground md:max-w-[75%] md:text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-600">
          <span className="text-xs text-white" aria-hidden="true">✦</span>
        </div>
        <div
          className={cn(
            'max-w-[90%] rounded-2xl rounded-tl-sm border bg-card px-3.5 py-2.5 text-sm md:max-w-[80%] md:px-4',
            'prose prose-sm prose-neutral dark:prose-invert max-w-none',
            '[&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3',
            '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs',
            '[&_table]:text-xs [&_td]:px-2 [&_th]:px-2',
            '[&_p]:leading-relaxed [&_p:last-child]:mb-0'
          )}
        >
          {message.content ? (
            <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
          ) : (
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground/40 motion-safe:animate-pulse" />
          )}
        </div>
      </div>
      {message.thinkingSteps && message.thinkingSteps.length > 0 && (
        <ThinkingSteps steps={message.thinkingSteps} />
      )}
    </div>
  )
}
