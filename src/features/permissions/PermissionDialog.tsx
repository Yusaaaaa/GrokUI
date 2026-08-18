import { translate } from "@/lib/i18n";
import { resolvePermission } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useSettingsStore } from "@/stores/settings-store";

export function PermissionDialog() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const permission = useAppStore((state) => state.permission);
  const setPermission = useAppStore((state) => state.setPermission);

  if (!permission) return null;
  const request = permission;

  const title = request.toolCall?.title ?? t("permission.title");
  const options = (request.options ?? []).map((option) => ({
    optionId: option.optionId || (option as { id?: string }).id || "",
    name: option.name || option.optionId,
  })).filter((option) => option.optionId);

  async function choose(optionId: string | null) {
    try {
      await resolvePermission(request.requestId, optionId);
    } finally {
      setPermission(null);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4">
      <div className="w-[420px] rounded-2xl border border-border bg-elevated p-4 shadow-[var(--shadow)]">
        <div className="text-[12px] uppercase tracking-[0.06em] text-subtle">
          {t("permission.title")}
        </div>
        <h2 className="mt-1 text-[16px] font-medium">{title}</h2>
        {permission.toolCall?.kind ? (
          <p className="mt-1 font-mono text-[12px] text-muted">{permission.toolCall.kind}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          {options.map((option) => (
            <button
              key={option.optionId}
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-hover"
              onClick={() => void choose(option.optionId)}
            >
              {option.name}
            </button>
          ))}
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-[13px] text-muted hover:bg-hover"
            onClick={() => void choose(null)}
          >
            {t("permission.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
