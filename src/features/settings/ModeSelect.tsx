import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Shield, ListTodo, Gauge, TriangleAlert } from "lucide-react";
import { translate } from "@/lib/i18n";
import { sendPrompt } from "@/lib/tauri";
import type { PermissionMode } from "@/lib/types";
import { useActiveBusy, useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

const MODES: Array<{
  id: PermissionMode;
  label: "topbar.ask" | "topbar.plan" | "topbar.auto" | "topbar.always";
  hint: "mode.askHint" | "mode.planHint" | "mode.autoHint" | "mode.alwaysHint";
  icon: typeof Shield;
}> = [
  { id: "ask", label: "topbar.ask", hint: "mode.askHint", icon: Shield },
  { id: "plan", label: "topbar.plan", hint: "mode.planHint", icon: ListTodo },
  { id: "auto", label: "topbar.auto", hint: "mode.autoHint", icon: Gauge },
  { id: "always", label: "topbar.always", hint: "mode.alwaysHint", icon: TriangleAlert },
];

const COMMAND: Record<PermissionMode, string> = {
  ask: "/always-approve off",
  plan: "/plan",
  auto: "/auto",
  always: "/always-approve on",
};

export function ModeSelect() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const mode = useSettingsStore((state) => state.permissionMode);
  const setPermissionMode = useSettingsStore((state) => state.setPermissionMode);
  const sessionId = useSessionStore((state) => state.activeSessionId);
  const busy = useActiveBusy();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = MODES.find((item) => item.id === mode) ?? MODES[0];
  const Icon = selected.icon;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open]);

  async function change(next: PermissionMode) {
    setOpen(false);
    setPermissionMode(next);
    if (!sessionId || busy) return;
    try {
      await sendPrompt(sessionId, COMMAND[next]);
    } catch {
      // Mode still applies to the next session.
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 text-[12px] text-fg backdrop-blur-md hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
        title={t(selected.hint)}
      >
        <Icon className="size-3.5 text-subtle" />
        {t(selected.label)}
        <ChevronDown className="size-3 text-subtle" />
      </button>
      {open ? (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-30 w-[260px] rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] p-1.5 shadow-[var(--shadow)] backdrop-blur-2xl">
          <div className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-[0.08em] text-subtle">
            {t("mode.label")}
          </div>
          {MODES.map((item) => {
            const ItemIcon = item.icon;
            const active = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${
                  active ? "bg-white/10" : "hover:bg-white/6"
                }`}
                onClick={() => void change(item.id)}
              >
                <ItemIcon className="mt-0.5 size-3.5 shrink-0 text-subtle" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-medium">{t(item.label)}</span>
                  <span className="block text-[11px] text-muted">{t(item.hint)}</span>
                </span>
                {active ? <Check className="mt-0.5 size-3.5 text-fg" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
