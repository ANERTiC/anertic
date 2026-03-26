import { useState, useEffect, useRef } from "react";
import { ScrollReveal } from "./scroll-reveal";

type ConversationItem =
  | { role: "user"; text: string }
  | { role: "ai"; text: string }
  | { role: "separator"; text: string };

const CONVERSATION: ConversationItem[] = [
  {
    role: "user",
    text: "How much energy did building A use this month?",
  },
  {
    role: "ai",
    text: "Building A consumed 12,847 kWh this month — 18% less than last month. Peak usage shifted to 2–5 PM. Shifting EV charging to off-peak could save an estimated $4,200/month.",
  },
  {
    role: "user",
    text: "Schedule charger 3 to start at off-peak hours",
  },
  {
    role: "ai",
    text: "Done. Charger 3 will now charge during off-peak hours (10 PM – 6 AM). Based on current TOU rates, this saves approximately $1,400/month.",
  },
  {
    role: "separator",
    text: "Today, 8:00 AM",
  },
  {
    role: "ai",
    text: "Good morning! Here's your daily report: Total consumption yesterday was 847 kWh across 3 sites. Charger 3 completed 4 off-peak sessions saving $186. Building B's HVAC ran 2 hours longer than usual — I've flagged it for review.",
  },
];

interface DisplayMessage {
  role: "user" | "ai" | "separator";
  text: string;
  isStreaming?: boolean;
}

function useChatAnimation(inView: boolean) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [showTyping, setShowTyping] = useState(false);
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!inView || hasPlayed.current) return;
    hasPlayed.current = true;

    let cancelled = false;

    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    async function animate() {
      const displayed: DisplayMessage[] = [];

      for (let mi = 0; mi < CONVERSATION.length; mi++) {
        const msg = CONVERSATION[mi];
        if (cancelled) return;

        if (msg.role === "separator") {
          await delay(1500);
          if (cancelled) return;
          displayed.push({ role: "separator", text: msg.text });
          setMessages([...displayed]);
        } else if (msg.role === "user") {
          await delay(mi === 0 ? 800 : 1500);
          if (cancelled) return;
          displayed.push({ role: "user", text: msg.text });
          setMessages([...displayed]);
        } else {
          await delay(600);
          if (cancelled) return;
          setShowTyping(true);

          await delay(1200);
          if (cancelled) return;
          setShowTyping(false);

          const words = msg.text.split(" ");
          const aiMsg: DisplayMessage = {
            role: "ai",
            text: "",
            isStreaming: true,
          };
          displayed.push(aiMsg);

          for (let wi = 0; wi < words.length; wi++) {
            if (cancelled) return;
            aiMsg.text = words.slice(0, wi + 1).join(" ");
            setMessages(displayed.map((m) => ({ ...m })));
            await delay(50);
          }

          aiMsg.isStreaming = false;
          setMessages(displayed.map((m) => ({ ...m })));
        }
      }
    }

    animate();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  return { messages, showTyping };
}

function AiAvatar() {
  return (
    <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      className="flex justify-start motion-safe:animate-rise"
      style={{ animationDuration: "0.3s" }}
    >
      <AiAvatar />
      <div className="flex items-center gap-1 rounded-2xl bg-bg-soft px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-3 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function TimeSeparator({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-3 py-1 motion-safe:animate-rise"
      style={{ animationDuration: "0.3s" }}
    >
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium text-text-3">{text}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function ChatMessage({ msg }: { msg: DisplayMessage }) {
  if (msg.role === "separator") {
    return <TimeSeparator text={msg.text} />;
  }

  const isUser = msg.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} motion-safe:animate-rise`}
      style={{ animationDuration: "0.3s" }}
    >
      {!isUser && <AiAvatar />}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
          isUser ? "bg-accent text-white" : "bg-bg-soft text-text"
        }`}
      >
        {msg.text}
        {msg.isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-accent align-middle" />
        )}
      </div>
    </div>
  );
}

export function InAction() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { messages, showTyping } = useChatAnimation(inView);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="in-action" className="mx-auto max-w-[1120px] px-8 py-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — text */}
        <ScrollReveal>
          <p className="text-xs font-bold tracking-[0.08em] text-accent">
            SEE IT IN ACTION
          </p>
          <h2 className="mt-2.5 text-4xl font-extrabold leading-tight tracking-[-0.035em]">
            Talk to your <span className="text-accent">energy</span>
          </h2>
          <p className="mt-4 max-w-[380px] text-[15px] leading-relaxed text-text-2">
            Ask about consumption, schedule EV chargers, get cost-saving
            recommendations — all through natural conversation with your AI
            agent.
          </p>
        </ScrollReveal>

        {/* Right — chat mockup */}
        <ScrollReveal delay={100}>
          <div ref={sectionRef} className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_8px_40px_rgba(0,0,0,0.06)]">
            {/* Title bar */}
            <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="ml-2 text-xs font-semibold text-text-2">
                ANERTiC AI Agent
              </span>
            </div>

            {/* Messages area */}
            <div className="flex h-[400px] flex-col gap-3 overflow-y-auto px-5 py-4">
              {messages.map((msg, i) => (
                <ChatMessage key={`${i}-${msg.role}`} msg={msg} />
              ))}
              {showTyping && <TypingIndicator />}
            </div>

            {/* Input bar (decorative) */}
            <div className="border-t border-border px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-soft px-4 py-2.5">
                <span className="flex-1 text-[13px] text-text-3">
                  Ask your energy agent...
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
