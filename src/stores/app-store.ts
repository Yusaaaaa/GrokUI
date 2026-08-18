import { create } from "zustand";
import type { CliStatus, PermissionRequest } from "@/lib/tauri";

export type Screen = "boot" | "onboarding" | "main";
export type AgentState = "idle" | "connecting" | "ready" | "disconnected";

interface AppState {
  screen: Screen;
  settingsOpen: boolean;
  previewPath: string | null;
  cli: CliStatus | null;
  agentState: AgentState;
  agentMessage: string | null;
  permission: PermissionRequest | null;
  setScreen: (screen: Screen) => void;
  setSettingsOpen: (open: boolean) => void;
  setPreviewPath: (path: string | null) => void;
  setCli: (cli: CliStatus | null) => void;
  setAgentState: (state: AgentState, message?: string | null) => void;
  setPermission: (permission: PermissionRequest | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "main",
  settingsOpen: false,
  previewPath: null,
  cli: null,
  agentState: "idle",
  agentMessage: null,
  permission: null,
  setScreen: (screen) => set({ screen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setPreviewPath: (previewPath) => set({ previewPath }),
  setCli: (cli) => set({ cli }),
  setAgentState: (agentState, agentMessage = null) => set({ agentState, agentMessage }),
  setPermission: (permission) => set({ permission }),
}));
