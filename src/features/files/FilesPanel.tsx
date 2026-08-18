import { startWindowDrag } from "@/lib/window-drag";
import { TokenUsage } from "@/features/usage/TokenUsage";
import { FileTree } from "./FileTree";
import { translate } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings-store";

export function FilesPanel() {
  const locale = useSettingsStore((state) => state.locale);
  const filesRoot = useSettingsStore((state) => state.filesRoot);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-sidebar">
      <div className="px-3 pb-2 pt-3" onMouseDown={startWindowDrag}>
        <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-subtle">
          {translate(locale, "files.title")}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">
          {filesRoot}
        </div>
      </div>
      <div className="min-h-0 flex-[1.1] overflow-y-auto">
        <FileTree root={filesRoot} />
      </div>
      <TokenUsage />
    </aside>
  );
}
