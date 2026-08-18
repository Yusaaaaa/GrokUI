import { startWindowDrag } from "@/lib/window-drag";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/lib/i18n";
import { useActiveProject } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

export function TopBar() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const rightPanelOpen = useSettingsStore((state) => state.rightPanelOpen);
  const toggleRightPanel = useSettingsStore((state) => state.toggleRightPanel);
  const project = useActiveProject();

  return (
    <header
      className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[color-mix(in_srgb,var(--bg)_70%,transparent)] px-3 backdrop-blur-xl"
      data-tauri-drag-region
      onMouseDown={startWindowDrag}
    >
      <div className="min-w-0 pl-1">
        <div className="truncate text-[13px] font-medium">{project?.name ?? t("app.name")}</div>
        <div className="truncate font-mono text-[11px] text-subtle">{project?.cwd}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="icon"
          active={rightPanelOpen}
          onClick={toggleRightPanel}
          title={t("topbar.files")}
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
    </header>
  );
}
