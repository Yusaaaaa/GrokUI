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
  lastCwd: string | null;
  filesRoot: string;
  cliPath: string;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setModel: (model: string) => void;
  setModels: (models: string[]) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  toggleRightPanel: () => void;
  setLastCwd: (cwd: string) => void;
  setFilesRoot: (path: string) => void;
  setCliPath: (path: string) => void;
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
      lastCwd: "/Users/yusa/GrokWorkSpace",
      filesRoot: "/Users/yusa/GrokWorkSpace",
      cliPath: "",
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
      setLastCwd: (lastCwd) => set({ lastCwd }),
      setFilesRoot: (filesRoot) => set({ filesRoot }),
      setCliPath: (cliPath) => set({ cliPath }),
    }),
    {
      name: "grokui-settings",
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.theme ?? "dark");
        if (state && !state.filesRoot) {
          state.filesRoot = "/Users/yusa/GrokWorkSpace";
        }
      },
    },
  ),
);
