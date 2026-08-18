import { startWindowDrag } from "@/lib/window-drag";

/** Full-width drag handle. Overlay title bar has no native chrome to grab. */
export function Titlebar() {
  return (
    <div
      className="h-11 w-full shrink-0 cursor-default border-b border-border bg-sidebar"
      onMouseDown={startWindowDrag}
    />
  );
}
