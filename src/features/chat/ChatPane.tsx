import { useEffect, useRef } from "react";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { reconnect } from "@/features/chat/useAgentConnection";
import { translate } from "@/lib/i18n";
import { useAppStore } from "@/stores/app-store";
import {
  useActiveBusy,
  useActiveTranscript,
  useSessionStore,
} from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

export function ChatPane() {
  const blocks = useActiveTranscript();
  const tick = useSessionStore((state) => state.streamTick);
  const error = useSessionStore((state) => state.error);
  const connecting = useSessionStore((state) => state.connecting);
  const busy = useActiveBusy();
  const agentState = useAppStore((state) => state.agentState);
  const locale = useSettingsStore((state) => state.locale);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [blocks.length, tick]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <MessageList blocks={blocks} busy={busy} />
      </div>
      {agentState === "disconnected" ? (
        <div className="flex items-center justify-center gap-3 px-6 pb-2 text-[12px] text-exec">
          <span>{translate(locale, "chat.disconnected")}</span>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-fg hover:bg-hover"
            onClick={() => void reconnect()}
          >
            {translate(locale, "chat.reconnect")}
          </button>
        </div>
      ) : connecting || agentState === "connecting" ? (
        <p className="px-6 pb-2 text-center text-[12px] text-muted">
          {translate(locale, "chat.connecting")}
        </p>
      ) : null}
      {error ? (
        <p className="px-6 pb-2 text-center text-[12px] text-exec">{error}</p>
      ) : null}
      <Composer />
    </section>
  );
}
