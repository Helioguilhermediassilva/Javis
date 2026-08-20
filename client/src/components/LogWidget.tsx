import { useState, useEffect, useRef } from "react";

const C = {
  PANEL: "#010d14",
  BORDER: "#0d3347",
  PRI: "#00d4ff",
  RED: "#ff3355",
  GREEN: "#00ff88",
  ACC2: "#ffcc00",
  WHITE: "#d8f8ff",
};

interface LogEntry {
  text: string;
  color: string;
  // How many characters are currently revealed (for typing effect on the latest item)
  revealed: number;
  done: boolean;
}

function getLogColor(text: string): string {
  const tl = text.toLowerCase();
  if (tl.startsWith("you:")) return C.WHITE;
  if (tl.startsWith("xavier:")) return C.PRI;
  if (tl.startsWith("file:")) return C.GREEN;
  if (tl.includes("err")) return C.RED;
  return C.ACC2;
}

interface LogWidgetProps {
  logs: string[];
  compact?: boolean;
}

/**
 * Simple, StrictMode-safe log widget with progressive typing effect.
 *
 * Strategy:
 *   - We mirror `logs` (a `string[]` from the parent) into local `entries` state.
 *   - When `logs.length` grows, we append the new items as `done: false, revealed: 0`.
 *   - A single interval ticks ~every 8ms and reveals one more char of the first
 *     non-done entry. When all chars are revealed, mark `done: true`.
 *   - This avoids cross-effect coordination via refs and works under StrictMode.
 */
export default function LogWidget({ logs, compact = false }: LogWidgetProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processedRef = useRef(0);

  // Sync incoming `logs` into local entries (append-only)
  useEffect(() => {
    if (logs.length > processedRef.current) {
      const newItems = logs.slice(processedRef.current).map((text) => ({
        text,
        color: getLogColor(text),
        revealed: 0,
        done: false,
      }));
      processedRef.current = logs.length;
      setEntries((prev) => [...prev, ...newItems]);
    }
  }, [logs]);

  // Typing animation: reveal one char at a time on the first non-done entry
  useEffect(() => {
    const id = window.setInterval(() => {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => !e.done);
        if (idx === -1) return prev;
        const e = prev[idx];
        const nextRevealed = Math.min(e.text.length, e.revealed + 2);
        const nextDone = nextRevealed >= e.text.length;
        const next = prev.slice();
        next[idx] = { ...e, revealed: nextRevealed, done: nextDone };
        return next;
      });
    }, 12);
    return () => window.clearInterval(id);
  }, []);

  // Auto-scroll on changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div
      ref={scrollRef}
      className={compact ? "h-[118px] shrink-0 overflow-y-auto overflow-x-hidden" : "flex-1 overflow-y-auto overflow-x-hidden"}
      style={{
        background: C.PANEL,
        border: `1px solid ${C.BORDER}`,
        borderRadius: "4px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        lineHeight: "1.7",
        padding: "6px",
        minHeight: compact ? "64px" : "100px",
      }}
    >
      {entries.map((e, i) => {
        const isLastTyping = !e.done;
        const visible = e.text.slice(0, e.revealed);
        return (
          <div
            key={i}
            style={{ color: e.color }}
            className="whitespace-pre-wrap break-words"
          >
            {visible}
            {isLastTyping && (
              <span
                className="inline-block w-[1px] h-[10px] ml-[1px] animate-pulse"
                style={{ background: e.color }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
