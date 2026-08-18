import type { MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./tauri";

export function startWindowDrag(event: MouseEvent) {
  if (!isTauri() || event.button !== 0) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("button, input, textarea, select, a, [data-no-drag]")) {
    return;
  }
  event.preventDefault();
  void getCurrentWindow().startDragging();
}
