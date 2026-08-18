import { useEffect, useMemo, useState } from "react";
import { translate } from "@/lib/i18n";
import { monthUsage, onTurnEnd, type MonthUsage } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";

export function TokenUsage() {
  const locale = useSettingsStore((state) => state.locale);
  const [data, setData] = useState<MonthUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await monthUsage();
      setData(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const unlisten = onTurnEnd(() => {
      void refresh();
    });
    return () => {
      window.clearInterval(timer);
      void unlisten.then((stop) => stop());
    };
  }, []);

  const max = useMemo(
    () => Math.max(1, ...(data?.days.map((day) => day.total) ?? [1])),
    [data],
  );
  const today = todayDay(data?.year, data?.month);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border">
      <div className="px-3 py-2">
        <div className="text-[11px] uppercase tracking-[0.06em] text-subtle">
          {translate(locale, "usage.title")}
        </div>
        {data ? (
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium">
              {formatMonth(data.year, data.month, locale)}
            </span>
            <span className="font-mono text-[12px] text-fg">{formatTokens(data.total)}</span>
          </div>
        ) : null}
        {data ? (
          <div className="mt-0.5 font-mono text-[10px] text-subtle">
            {formatTokens(data.input)} in · {formatTokens(data.output)} out · {data.turns}{" "}
            {translate(locale, "usage.turns")}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {error ? <p className="text-[12px] text-exec">{error}</p> : null}
        {!data && !error ? (
          <p className="text-[12px] text-subtle">{translate(locale, "usage.loading")}</p>
        ) : null}
        {data
          ? data.days.map((day) => {
              const active = day.total > 0;
              const isToday = day.day === today;
              return (
                <div
                  key={day.date}
                  className={`mb-1.5 ${isToday ? "text-fg" : "text-muted"}`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className={isToday ? "font-medium" : ""}>
                      {day.day}
                      {isToday ? ` · ${translate(locale, "usage.today")}` : ""}
                    </span>
                    <span className="font-mono">
                      {active ? formatTokens(day.total) : "—"}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-hover">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{
                        width: `${active ? Math.max(4, (day.total / max) * 100) : 0}%`,
                        opacity: active ? 0.85 : 0.2,
                      }}
                    />
                  </div>
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

function formatMonth(year: number, month: number, locale: "en" | "zh"): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
  });
}

function todayDay(year?: number, month?: number): number | null {
  if (!year || !month) return null;
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return now.getDate();
  }
  return null;
}
