import { useState, useEffect, useRef } from "react";
import { ScrollReveal } from "./scroll-reveal";

const NOTIFICATIONS = [
  {
    icon: "sun",
    time: "Just now",
    title: "Solar output is high",
    body: "Your panels are producing 4.2 kW right now. Great time to run the washing machine — it's free energy.",
    accent: "#f59e0b",
  },
  {
    icon: "cloud-rain",
    time: "8:32 PM",
    title: "Rain forecast tomorrow",
    body: "All-day rain expected — solar will drop to ~0.8 kW. Charge your EV tonight while rates are ฿3.2/kWh (peak tomorrow: ฿7.8).",
    accent: "#6366f1",
  },
  {
    icon: "zap",
    time: "5:45 PM",
    title: "Off-peak starts in 15 min",
    body: "Electricity drops from ฿5.4 to ฿3.2/kWh at 6 PM. Good time for the dishwasher or dryer.",
    accent: "#0d9668",
  },
  {
    icon: "piggy-bank",
    time: "Monday, 9:00 AM",
    title: "Weekly savings report",
    body: "You saved ฿420 this week by timing your energy use. That's 14% less than a typical household.",
    accent: "#e11d48",
  },
];

function NotificationIcon({
  type,
  color,
}: {
  type: string;
  color: string;
}) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "sun":
      return (
        <svg aria-hidden="true" {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "cloud-rain":
      return (
        <svg aria-hidden="true" {...props}>
          <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
          <path d="M8 16v2M12 16v2M16 16v2" />
        </svg>
      );
    case "zap":
      return (
        <svg aria-hidden="true" {...props}>
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case "piggy-bank":
      return (
        <svg aria-hidden="true" {...props}>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    default:
      return null;
  }
}

function useStaggeredReveal(inView: boolean, count: number) {
  const [visible, setVisible] = useState<boolean[]>(
    Array(count).fill(false),
  );
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!inView || hasPlayed.current) return;
    hasPlayed.current = true;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setVisible((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, 400 + i * 350),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [inView, count]);

  return visible;
}

export function Notifications() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const visible = useStaggeredReveal(inView, NOTIFICATIONS.length);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full bg-bg-soft"
    >
      <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <ScrollReveal>
            <p className="text-xs font-bold tracking-[0.08em] text-accent">
              NO SMART PLUGS NEEDED
            </p>
            <h2 className="mt-2.5 text-pretty text-3xl font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">
              Save 10–15% with just{" "}
              <span className="text-accent">notifications</span>
            </h2>
            <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-text-2">
              Your AI watches weather, solar production, and electricity rates —
              then sends the right tip at the right time. No device control
              needed.
            </p>

            <ul className="mt-6 flex flex-col gap-2.5">
              {[
                "Weather-aware energy recommendations",
                "Solar production forecasting",
                "Time-of-use rate optimization",
                "Works with any home — no hardware required",
              ].map((item) => (
                <li
                  key={item}
                  className="relative pl-5 text-[13.5px] text-text-2 before:absolute before:left-0 before:top-[7px] before:h-2 before:w-2 before:rounded-full before:bg-accent/20 after:absolute after:left-[3px] after:top-[10px] after:h-[5px] after:w-[5px] after:rounded-full after:bg-accent"
                >
                  {item}
                </li>
              ))}
            </ul>
          </ScrollReveal>

          {/* Right — phone mockup */}
          <ScrollReveal delay={100}>
            <div className="mx-auto w-full max-w-[340px]">
              {/* Phone frame */}
              <div className="overflow-hidden rounded-[32px] border-[6px] border-[#1a1a1a] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
                {/* Status bar */}
                <div className="flex items-center justify-between bg-white px-5 pb-1 pt-3">
                  <span className="text-[12px] font-semibold text-text tabular-nums">
                    9:41
                  </span>
                  <div className="flex items-center gap-1">
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1a1a1a"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
                    </svg>
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="12"
                      viewBox="0 0 28 14"
                      fill="none"
                    >
                      <rect
                        x="0.5"
                        y="0.5"
                        width="23"
                        height="13"
                        rx="2.5"
                        stroke="#1a1a1a"
                        strokeWidth="1"
                      />
                      <rect
                        x="2"
                        y="2"
                        width="16"
                        height="10"
                        rx="1"
                        fill="#0d9668"
                      />
                      <rect
                        x="25"
                        y="4"
                        width="2"
                        height="6"
                        rx="0.5"
                        fill="#1a1a1a"
                        opacity="0.4"
                      />
                    </svg>
                  </div>
                </div>

                {/* Notification area */}
                <div className="flex flex-col gap-2.5 px-3 pb-6 pt-3">
                  {/* App header */}
                  <div className="mb-1 flex items-center gap-2 px-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent">
                      <svg
                        aria-hidden="true"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-semibold tracking-wide text-text-3">
                      ANERTIC
                    </span>
                  </div>

                  {/* Notification cards */}
                  {NOTIFICATIONS.map((notif, i) => (
                    <div
                      key={notif.title}
                      className="motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{
                        opacity: visible[i] ? 1 : 0,
                        transform: visible[i]
                          ? "translateY(0)"
                          : "translateY(16px)",
                      }}
                    >
                      <div className="rounded-2xl bg-bg-soft p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: `${notif.accent}12`,
                            }}
                          >
                            <NotificationIcon
                              type={notif.icon}
                              color={notif.accent}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[12.5px] font-bold leading-snug text-text">
                                {notif.title}
                              </p>
                              <span className="shrink-0 text-[10px] text-text-3">
                                {notif.time}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11.5px] leading-[1.45] text-text-2">
                              {notif.body}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Home indicator */}
                <div className="flex justify-center pb-2">
                  <div className="h-1 w-28 rounded-full bg-[#1a1a1a]/10" />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
