import { ChatPane } from "@/features/chat/ChatPane";
import { FilesPanel } from "@/features/files/FilesPanel";
import { PermissionDialog } from "@/features/permissions/PermissionDialog";
import { SettingsSheet } from "@/features/settings/SettingsSheet";
import { Sidebar } from "@/features/sessions/Sidebar";
import { useSettingsStore } from "@/stores/settings-store";
import { Titlebar } from "./Titlebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const rightPanelOpen = useSettingsStore((state) => state.rightPanelOpen);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg text-fg">
      <Titlebar />
      <div className="flex min-h-0 min-w-0 flex-1">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar />
          <ChatPane />
        </div>
        {rightPanelOpen ? <FilesPanel /> : null}
      </div>
      <SettingsSheet />
      <PermissionDialog />
    </div>
  );
}
