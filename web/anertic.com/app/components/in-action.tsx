import { useState, useEffect, useRef } from "react";
import { ScrollReveal } from "./scroll-reveal";

type ConversationItem =
  | { role: "user"; text: string }
  | { role: "ai"; text: string }
  | { role: "separator"; text: string };

const CONVERSATION: ConversationItem[] = [
  {
    role: "user",
    text: "How much energy did my house use yesterday?",
  },
  {
    role: "ai",
    text: "Your home used 32.4 kWh yesterday — 12% below your weekly average. Solar covered 18.7 kWh (58%). Your EV charged 8.2 kWh during off-peak hours, saving ฿45.",
  },
  {
    role: "user",
    text: "Schedule the car charger for tonight's cheapest rate",
  },
  {
    role: "ai",
    text: "Done. Your charger will start at 10:30 PM when rates drop to ฿3.2/kWh. Estimated cost for a full charge: ฿128 (vs ฿215 at peak rates).",
  },
  {
    role: "separator",
    text: "Today, 7:00 AM",
  },
  {
    role: "ai",
    text: "Good morning! Yesterday your solar generated 22.1 kWh — 94% of capacity. EV charging saved ฿87 on off-peak rates. One thing: your kitchen circuit spiked at 3 AM for 2 hours — worth checking.",
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
    <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d9668]">
      <svg
        aria-hidden="true"
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
      <div className="flex items-center gap-1 rounded-2xl bg-[#1e2130] px-4 py-3">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a5068] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a5068] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4a5068] [animation-delay:300ms]" />
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
      <div className="h-px flex-1 bg-[#2a2d37]" />
      <span className="text-[11px] font-medium text-[#6b7280]">{text}</span>
      <div className="h-px flex-1 bg-[#2a2d37]" />
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
          isUser
            ? "bg-[#0d9668] text-white"
            : "bg-[#1e2130] text-[#d1d5db]"
        }`}
      >
        {msg.text}
        {msg.isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-[#34d399] align-middle" />
        )}
      </div>
    </div>
  );
}

export function InAction() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, showTyping]);

  return (
    <section
      id="in-action"
      style={{ backgroundColor: "#0f1117" }}
      className="w-full py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <ScrollReveal>
            <p className="text-xs font-bold tracking-[0.08em] text-[#34d399]">
              SEE IT IN ACTION
            </p>
            <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] text-white sm:text-4xl">
              Talk to your <span className="text-[#34d399]">home</span>
            </h2>
            <p className="mt-4 max-w-[380px] text-[15px] leading-relaxed text-[#9ca3af]">
              Ask about your solar production, schedule EV charging, get savings
              recommendations — all through natural conversation with your AI.
            </p>
          </ScrollReveal>

          {/* Right — chat mockup */}
          <ScrollReveal delay={100}>
            <div
              ref={sectionRef}
              className="overflow-hidden rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.4)]"
              style={{
                backgroundColor: "#1a1d27",
                border: "1px solid #2a2d37",
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center gap-2 px-5 py-3.5"
                style={{
                  backgroundColor: "#141720",
                  borderBottom: "1px solid #2a2d37",
                }}
              >
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="ml-2 text-xs font-semibold text-[#9ca3af]">
                  Home Energy AI
                </span>
              </div>

              {/* Messages area */}
              <div
                ref={messagesRef}
                className="flex h-[320px] flex-col gap-3 overflow-y-auto px-4 py-4 sm:h-[400px] sm:px-5"
                style={{ backgroundColor: "#1a1d27" }}
              >
                {messages.map((msg, i) => (
                  <ChatMessage key={`${i}-${msg.role}`} msg={msg} />
                ))}
                {showTyping && <TypingIndicator />}
              </div>

              {/* Input bar (decorative) */}
              <div
                className="px-5 py-3"
                style={{ borderTop: "1px solid #2a2d37" }}
              >
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                  style={{
                    backgroundColor: "#141720",
                    border: "1px solid #2a2d37",
                  }}
                >
                  <span className="flex-1 text-[13px] text-[#4b5563]">
                    Ask your energy AI…
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d9668]">
                    <svg
                      aria-hidden="true"
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
      </div>
    </section>
  );
}
