import { ThoughtBlock } from "./ThoughtBlock";
import { ToolCard } from "./ToolCard";
import { PlanBlock } from "./PlanBlock";
import { MarkdownBody } from "./MarkdownBody";
import { translate } from "@/lib/i18n";
import type { ChatBlock } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

interface MessageListProps {
  blocks: ChatBlock[];
  busy?: boolean;
}

export function MessageList({ blocks, busy = false }: MessageListProps) {
  const locale = useSettingsStore((state) => state.locale);

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
      {blocks.map((block) => {
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
          const lastThought = [...blocks].reverse().find((item) => item.type === "thought");
          return (
            <ThoughtBlock
              key={block.id}
              text={block.text}
              live={busy && lastThought?.id === block.id}
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
