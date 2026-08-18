import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSelect } from "./ModelSelect";
import { translate, type Locale } from "@/lib/i18n";
import { getAppInfo, type AppInfo } from "@/lib/tauri";
import type { ThemePreference } from "@/lib/theme";
import { useAppStore } from "@/stores/app-store";
import { useSettingsStore } from "@/stores/settings-store";

export function SettingsSheet() {
  const open = useAppStore((state) => state.settingsOpen);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const locale = useSettingsStore((state) => state.locale);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  useEffect(() => {
    if (!open) return;
    void getAppInfo().then(setInfo);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-end bg-black/20 p-4 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
    >
      <div
        className="mt-12 w-[320px] rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--bg-elevated)_74%,transparent)] p-4 shadow-[var(--shadow)] backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium">{t("settings.title")}</h2>
          <Button variant="icon" onClick={() => setOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <Field label={t("settings.theme")}>
          <Segmented<ThemePreference>
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: t("settings.theme.system") },
              { value: "dark", label: t("settings.theme.dark") },
              { value: "light", label: t("settings.theme.light") },
            ]}
          />
        </Field>

        <Field label={t("settings.language")}>
          <Segmented<Locale>
            value={locale}
            onChange={setLocale}
            options={[
              { value: "zh", label: t("settings.language.zh") },
              { value: "en", label: t("settings.language.en") },
            ]}
          />
        </Field>

        <Field label={t("settings.model")}>
          <ModelSelect />
        </Field>

        {info ? (
          <p className="mt-4 text-[11px] text-subtle">
            {info.name} · v{info.version} · {info.phase}
          </p>
        ) : (
          <p className="mt-4 text-[11px] text-subtle">GrokUI · {t("app.phaseBadge")}</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1.5 text-[12px] text-muted">{label}</div>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-bg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1 text-[12px] ${
            value === option.value ? "bg-elevated text-fg shadow-sm" : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
