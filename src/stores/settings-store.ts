import { create } from "zustand";
import { persist } from "zustand/middleware";
import { detectSystemLocale, type Locale } from "@/lib/i18n";
import type { PermissionMode } from "@/lib/types";
import { applyTheme, type ThemePreference } from "@/lib/theme";

interface SettingsState {
  theme: ThemePreference;
  locale: Locale;
  model: string;
  models: string[];
  permissionMode: PermissionMode;
  rightPanelOpen: boolean;
  rightPanelWidth: number;
  lastCwd: string | null;
  filesRoot: string;
  standaloneDir: string;
  cliPath: string;
  projectExpanded: Record<string, boolean>;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setModel: (model: string) => void;
  setModels: (models: string[]) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  toggleRightPanel: () => void;
  setRightPanelWidth: (width: number) => void;
  setLastCwd: (cwd: string) => void;
  setFilesRoot: (path: string) => void;
  setStandaloneDir: (path: string) => void;
  setCliPath: (path: string) => void;
  setProjectExpanded: (cwd: string, expanded: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      locale: detectSystemLocale(),
      model: "grok-4.6",
      models: ["grok-4.6", "grok-4.5"],
      permissionMode: "ask",
      rightPanelOpen: true,
      rightPanelWidth: 260,
      lastCwd: "/Users/yusa/GrokWorkSpace",
      filesRoot: "/Users/yusa/GrokWorkSpace",
      standaloneDir: "/Users/yusa/Documents/Grok Build/Chats",
      cliPath: "",
      projectExpanded: {},
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setLocale: (locale) => set({ locale }),
      setModel: (model) => set({ model }),
      setModels: (models) =>
        set((state) => ({
          models: models.length > 0 ? models : state.models,
          model: models.includes(state.model) ? state.model : (models[0] ?? state.model),
        })),
      setPermissionMode: (permissionMode) => set({ permissionMode }),
      toggleRightPanel: () =>
        set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setRightPanelWidth: (rightPanelWidth) =>
        set({ rightPanelWidth: Math.min(420, Math.max(220, rightPanelWidth)) }),
      setLastCwd: (lastCwd) => set({ lastCwd }),
      setFilesRoot: (filesRoot) => set({ filesRoot }),
      setStandaloneDir: (standaloneDir) => set({ standaloneDir }),
      setCliPath: (cliPath) => set({ cliPath }),
      setProjectExpanded: (cwd, expanded) =>
        set((state) => ({
          projectExpanded: { ...state.projectExpanded, [cwd]: expanded },
        })),
    }),
    {
      name: "grokui-settings",
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? "dark");
        if (state && !state.filesRoot) {
          state.filesRoot = "/Users/yusa/GrokWorkSpace";
        }
        if (state && state.rightPanelWidth > 360) {
          state.rightPanelWidth = 260;
        }
      },
    },
  ),
);
