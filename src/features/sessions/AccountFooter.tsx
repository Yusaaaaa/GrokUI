import { useEffect, useRef, useState } from "react";
import { Settings2, Gauge, RefreshCw } from "lucide-react";
import { TokenUsage } from "@/features/usage/TokenUsage";
import { reconnect } from "@/features/chat/useAgentConnection";
import { translate } from "@/lib/i18n";
import { getAppInfo } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useSettingsStore } from "@/stores/settings-store";

export function AccountFooter() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const cli = useAppStore((state) => state.cli);
  const agentState = useAppStore((state) => state.agentState);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const [open, setOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const name = cli?.account?.displayName || cli?.account?.email || t("app.name");
  const detail = cli?.account?.email || cli?.version || t("account.signedOut");
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "G";
  const live = agentState === "ready";

  useEffect(() => {
    void getAppInfo().then((info) => setVersion(info?.version ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setUsageOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0 border-t border-white/10">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-hover"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-active text-[12px] font-medium">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{name}</span>
          <span className="block truncate font-mono text-[10px] text-subtle">{detail}</span>
        </span>
        {live ? (
          <span className="rounded-full bg-ok/15 px-1.5 py-0.5 text-[10px] text-ok">
            {t("account.live")}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+8px)] left-2 right-2 z-20 rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--bg-elevated)_72%,transparent)] p-3 shadow-[var(--shadow)] backdrop-blur-2xl">
          <div className="mb-2 grid gap-1 text-[11px] text-muted">
            <div className="flex justify-between gap-2">
              <span>Grok Build</span>
              <span>{version ? `v${version}` : "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>CLI</span>
              <span className="truncate font-mono">{cli?.version ?? "—"}</span>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-hover"
            onClick={() => setUsageOpen((value) => !value)}
          >
            <Gauge className="size-3.5 text-subtle" />
            {t("account.usage")}
          </button>
          {usageOpen ? (
            <div className="mt-1 rounded-lg border border-border bg-bg p-2">
              <TokenUsage compact />
            </div>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-hover"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            <Settings2 className="size-3.5 text-subtle" />
            {t("account.settings")}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-hover"
            onClick={() => {
              setOpen(false);
              void reconnect();
            }}
          >
            <RefreshCw className="size-3.5 text-subtle" />
            {t("account.reconnect")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
