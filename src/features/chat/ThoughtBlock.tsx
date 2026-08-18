import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { translate } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings-store";

interface ThoughtBlockProps {
  text: string;
  live?: boolean;
}

export function ThoughtBlock({ text, live = false }: ThoughtBlockProps) {
  const [userOpen, setUserOpen] = useState(false);
  const open = live || userOpen;
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div className="rounded-xl border border-border bg-elevated">
      <button
        type="button"
        onClick={() => setUserOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-muted hover:text-fg"
      >
        <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-medium">{t("thought.title")}</span>
        <span className="text-[12px] text-subtle">
          {open ? t("thought.hide") : t("thought.show")}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border px-3 py-2.5 text-[13px] leading-6 text-muted">
          {text}
        </div>
      ) : null}
    </div>
  );
}
