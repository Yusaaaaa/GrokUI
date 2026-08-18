import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { translate } from "@/lib/i18n";
import type { ChatBlock } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

export function PlanBlock({ block }: { block: ChatBlock }) {
  const locale = useSettingsStore((state) => state.locale);

  return (
    <div className="rounded-xl border border-border bg-elevated px-3 py-2.5">
      <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-subtle">
        {translate(locale, "plan.title")}
      </div>
      <ul className="space-y-1.5">
        {(block.entries ?? []).map((entry) => (
          <li key={entry.id} className="flex items-start gap-2 text-[13px]">
            {entry.status === "completed" ? (
              <CircleCheck className="mt-0.5 size-3.5 text-ok" />
            ) : entry.status === "in_progress" ? (
              <CircleDot className="mt-0.5 size-3.5 text-warn" />
            ) : (
              <Circle className="mt-0.5 size-3.5 text-subtle" />
            )}
            <span className={entry.status === "completed" ? "text-muted" : "text-fg"}>
              {entry.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
