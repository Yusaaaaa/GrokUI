import { useMemo, useState } from "react";
import { ThoughtBlock } from "./ThoughtBlock";
import { ToolCard } from "./ToolCard";
import { PlanBlock } from "./PlanBlock";
import { MarkdownBody } from "./MarkdownBody";
import { translate } from "@/lib/i18n";
import type { ChatBlock } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

const INITIAL_VISIBLE = 48;

interface MessageListProps {
  blocks: ChatBlock[];
  busy?: boolean;
  loading?: boolean;
}

export function MessageList({ blocks, busy = false, loading = false }: MessageListProps) {
  const locale = useSettingsStore((state) => state.locale);
  const [showAll, setShowAll] = useState(false);
  const lastThoughtId = useMemo(() => {
    for (let i = blocks.length - 1; i >= 0; i -= 1) {
      if (blocks[i].type === "thought") return blocks[i].id;
    }
    return null;
  }, [blocks]);
  const hidden = !showAll && blocks.length > INITIAL_VISIBLE ? blocks.length - INITIAL_VISIBLE : 0;
  const visible = hidden > 0 ? blocks.slice(hidden) : blocks;

  if (loading && blocks.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-[14px] text-muted">{translate(locale, "chat.loadingHistory")}</p>
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-border bg-elevated text-lg font-semibold">
          G
        </div>
        <h2 className="text-[22px] font-medium tracking-tight">
          {translate(locale, "chat.emptyTitle")}
        </h2>
        <p className="mt-2 max-w-md text-[14px] leading-6 text-muted">
          {translate(locale, "chat.emptyBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-6 py-6">
      {hidden > 0 ? (
        <button
          type="button"
          className="self-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-muted hover:text-fg"
          onClick={() => setShowAll(true)}
        >
          {translate(locale, "chat.showEarlier")}
        </button>
      ) : null}
      {visible.map((block) => {
        if (block.type === "user") {
          return (
            <div key={block.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-user px-4 py-2.5 text-[14px] leading-6">
                {block.text}
              </div>
            </div>
          );
        }
        if (block.type === "thought" && block.text) {
          return (
            <ThoughtBlock
              key={block.id}
              text={block.text}
              live={busy && lastThoughtId === block.id}
            />
          );
        }
        if (block.type === "tool") {
          return <ToolCard key={block.id} block={block} />;
        }
        if (block.type === "plan") {
          return <PlanBlock key={block.id} block={block} />;
        }
        return <MarkdownBody key={block.id} text={block.text ?? ""} />;
      })}
    </div>
  );
}
