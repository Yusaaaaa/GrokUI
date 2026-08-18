import { useEffect, type ReactNode } from "react";
import { applyTheme } from "@/lib/theme";
import { useSettingsStore } from "@/stores/settings-store";

export function Providers({ children }: { children: ReactNode }) {
  const theme = useSettingsStore((state) => state.theme);
  const locale = useSettingsStore((state) => state.locale);

  useEffect(() => {
    applyTheme(theme);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [theme, locale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (useSettingsStore.getState().theme === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return children;
}
