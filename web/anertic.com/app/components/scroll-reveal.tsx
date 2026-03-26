import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '~/lib/utils'

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('show')
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -30px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'motion-safe:translate-y-7 motion-safe:opacity-0 motion-safe:transition-all motion-safe:duration-700',
        'motion-safe:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
        'motion-safe:[&.show]:translate-y-0 motion-safe:[&.show]:opacity-100',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}
