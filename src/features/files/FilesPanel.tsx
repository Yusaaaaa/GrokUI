import { useRef, type PointerEvent } from "react";
import { startWindowDrag } from "@/lib/window-drag";
import { FileTree } from "./FileTree";
import { translate } from "@/lib/i18n";
import { useActiveProject } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

export function FilesPanel() {
  const locale = useSettingsStore((state) => state.locale);
  const filesRoot = useSettingsStore((state) => state.filesRoot);
  const width = useSettingsStore((state) => state.rightPanelWidth);
  const setWidth = useSettingsStore((state) => state.setRightPanelWidth);
  const project = useActiveProject();
  const root = project?.cwd ?? filesRoot;
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  function onResizeStart(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    drag.current = { startX: event.clientX, startW: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setWidth(drag.current.startW + (drag.current.startX - event.clientX));
  }

  function onResizeEnd() {
    drag.current = null;
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-white/10 bg-[color-mix(in_srgb,var(--bg-sidebar)_72%,transparent)] backdrop-blur-2xl"
      style={{ width }}
    >
      <div
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
      />
      <div
        className="shrink-0 px-3 pb-2 pt-3"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      >
        <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-subtle">
          {translate(locale, "files.title")}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted" title={root}>
          {root}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FileTree root={root} />
      </div>
      <div className="min-h-[36%] shrink-0 border-t border-white/10" />
    </aside>
  );
}

