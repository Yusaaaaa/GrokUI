import { startWindowDrag } from "@/lib/window-drag";
import { PanelRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelect } from "@/features/settings/ModelSelect";
import { translate } from "@/lib/i18n";
import { sendPrompt } from "@/lib/tauri";
import type { PermissionMode } from "@/lib/types";
import { useAppStore } from "@/stores/app-store";
import { useActiveBusy, useActiveProject, useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

export function TopBar() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const permissionMode = useSettingsStore((state) => state.permissionMode);
  const setPermissionMode = useSettingsStore((state) => state.setPermissionMode);
  const sessionId = useSessionStore((state) => state.activeSessionId);
  const busy = useActiveBusy();

  async function changePermission(mode: PermissionMode) {
    setPermissionMode(mode);
    if (!sessionId || busy) return;
    try {
      await sendPrompt(sessionId, mode === "always" ? "/always-approve on" : "/always-approve off");
    } catch {
      // Setting still applies to the next session/new.
    }
  }
  const rightPanelOpen = useSettingsStore((state) => state.rightPanelOpen);
  const toggleRightPanel = useSettingsStore((state) => state.toggleRightPanel);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const project = useActiveProject();

  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3"
      onMouseDown={startWindowDrag}
    >
      <div className="min-w-0 pl-1">
        <div className="truncate text-[13px] font-medium">{project?.name ?? t("app.name")}</div>
        <div className="truncate font-mono text-[11px] text-subtle">{project?.cwd}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border bg-elevated p-0.5">
          <Button
            className="h-7 px-2 text-[12px]"
            active={permissionMode === "ask"}
            onClick={() => void changePermission("ask")}
            title={t("permission.askHint")}
          >
            {t("topbar.ask")}
          </Button>
          <Button
            className="h-7 px-2 text-[12px]"
            active={permissionMode === "always"}
            onClick={() => void changePermission("always")}
            title={t("permission.alwaysHint")}
          >
            {t("topbar.always")}
          </Button>
        </div>
        <ModelSelect />
        <Button
          variant="icon"
          active={rightPanelOpen}
          onClick={toggleRightPanel}
          title={t("topbar.files")}
        >
          <PanelRight className="size-4" />
        </Button>
        <Button variant="icon" onClick={() => setSettingsOpen(true)} title={t("topbar.settings")}>
          <Settings2 className="size-4" />
        </Button>
      </div>
    </header>
  );
}
