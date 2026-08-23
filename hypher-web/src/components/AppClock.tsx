"use client";

import { useEffect, useState } from "react";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatClock(date: Date): { time: string; date: string } {
  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
  return {
    time: `${pad(hour12)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${meridiem}`,
    date: `${months[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()}`,
  };
}

export function AppClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { time, date } = formatClock(now);

  return (
    <time
      className={["app-clock", className].filter(Boolean).join(" ")}
      dateTime={now.toISOString()}
      aria-hidden="true"
    >
      <span className="app-clock__time">{time}</span>
      <span className="app-clock__date">{date}</span>
    </time>
  );
}
