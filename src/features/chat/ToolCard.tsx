import { useState } from "react";
import {
  Check,
  FileSearch,
  FilePenLine,
  LoaderCircle,
  Search,
  SquareTerminal,
} from "lucide-react";
import { DiffPreview } from "./DiffPreview";
import { translate } from "@/lib/i18n";
import type { ChatBlock } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useSettingsStore } from "@/stores/settings-store";

const kindStyles = {
  read: { color: "var(--read)", Icon: FileSearch },
  edit: { color: "var(--edit)", Icon: FilePenLine },
  execute: { color: "var(--exec)", Icon: SquareTerminal },
  search: { color: "var(--search)", Icon: Search },
};

interface ToolCardProps {
  block: ChatBlock;
}

export function ToolCard({ block }: ToolCardProps) {
  const kind = block.kind ?? "read";
  const { color, Icon } = kindStyles[kind];
  const [open, setOpen] = useState(Boolean(block.diff));
  const locale = useSettingsStore((state) => state.locale);
  const setPreviewPath = useAppStore((state) => state.setPreviewPath);
  const status = block.status ?? "completed";

  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-elevated"
      style={{ boxShadow: "inset 3px 0 0 " + color }}
    >
      <div className="flex w-full items-center gap-2.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Icon className="size-3.5 shrink-0" style={{ color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] text-fg">{block.title}</div>
            {block.path ? (
              <span className="block truncate font-mono text-[11px] text-subtle">
                {block.path}
              </span>
            ) : null}
          </div>
        </button>
        {block.path ? (
          <button
            type="button"
            className="shrink-0 font-mono text-[11px] text-subtle hover:text-muted"
            onClick={() => setPreviewPath(block.path ?? null)}
          >
            →
          </button>
        ) : null}
        <StatusBadge
          status={status}
          label={translate(locale, `tool.${status}` as const)}
        />
      </div>
      {open && (block.detail || block.diff) ? (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {block.detail ? (
            <p className="font-mono text-[12px] text-muted">{block.detail}</p>
          ) : null}
          {block.diff ? <DiffPreview hunks={block.diff} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: NonNullable<ChatBlock["status"]>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
      {status === "running" ? (
        <LoaderCircle className="size-3 animate-spin text-warn" />
      ) : status === "completed" ? (
        <Check className="size-3 text-ok" />
      ) : (
        <span className="size-1.5 rounded-full bg-subtle" />
      )}
      {label}
    </span>
  );
}
