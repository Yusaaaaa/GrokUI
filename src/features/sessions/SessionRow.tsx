import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { translate } from "@/lib/i18n";
import type { SessionSummary } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

interface SessionRowProps {
  session: SessionSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPrefetch?: () => void;
}

export function SessionRow({ session, active, onSelect, onDelete, onPrefetch }: SessionRowProps) {
  const locale = useSettingsStore((state) => state.locale);
  const when = formatWhen(session.updatedAt, locale);

  return (
    <div
      className={cn(
        "group flex w-full items-start gap-1 rounded-lg pr-1 text-left transition-colors",
        active ? "bg-active" : "hover:bg-hover",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
        className="min-w-0 flex-1 px-2.5 py-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] text-fg">{session.title}</span>
          <span className="shrink-0 text-[11px] text-subtle">{when}</span>
        </div>
        {session.preview ? (
          <p className="mt-0.5 truncate text-[12px] text-muted">{session.preview}</p>
        ) : null}
      </button>
      <button
        type="button"
        className="mt-2 hidden rounded-md p-1 text-subtle hover:bg-hover hover:text-exec group-hover:block"
        title={translate(locale, "sidebar.delete")}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function formatWhen(value: string, locale: "en" | "zh"): string {
  if (value === "today") return translate(locale, "sidebar.today");
  if (value === "yesterday") return translate(locale, "sidebar.yesterday");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (date >= startToday) return translate(locale, "sidebar.today");
  if (date >= startYesterday) return translate(locale, "sidebar.yesterday");
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
