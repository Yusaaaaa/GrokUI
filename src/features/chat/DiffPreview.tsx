import { translate } from "@/lib/i18n";
import type { DiffHunk } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

interface DiffPreviewProps {
  hunks: DiffHunk[];
}

export function DiffPreview({ hunks }: DiffPreviewProps) {
  const locale = useSettingsStore((state) => state.locale);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-sidebar">
      <div className="border-b border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-subtle">
        {translate(locale, "diff.preview")}
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-6">
        {hunks.map((hunk) => (
          <div key={hunk.header}>
            <div className="text-subtle">{hunk.header}</div>
            {hunk.lines.map((line, index) => (
              <div
                key={`${hunk.header}-${index}`}
                className={
                  line.type === "add"
                    ? "bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-ok"
                    : line.type === "del"
                      ? "bg-[color-mix(in_srgb,var(--exec)_16%,transparent)] text-exec"
                      : "text-muted"
                }
              >
                {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                {line.text}
              </div>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}
