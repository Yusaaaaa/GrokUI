import { startWindowDrag } from "@/lib/window-drag";
import { useState, type ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { translate } from "@/lib/i18n";
import { cliStatus, startLogin, type CliStatus } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";

interface OnboardingScreenProps {
  status: CliStatus | null;
  onRefresh: () => Promise<void>;
}

const INSTALL = "curl -fsSL https://x.ai/cli/install.sh | bash";

export function OnboardingScreen({ status, onRefresh }: OnboardingScreenProps) {
  const locale = useSettingsStore((state) => state.locale);
  const cliPath = useSettingsStore((state) => state.cliPath);
  const setCliPath = useSettingsStore((state) => state.setCliPath);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const installed = Boolean(status?.installed);
  const loggedIn = Boolean(status?.loggedIn);

  async function recheck() {
    setBusy(true);
    setNote(null);
    try {
      await cliStatus(cliPath || null);
      await onRefresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setNote(null);
    try {
      await startLogin(cliPath || null);
      setNote(t("onboarding.loginStarted"));
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const next = await cliStatus(cliPath || null);
        if (next.loggedIn) {
          await onRefresh();
          return;
        }
      }
      setNote(t("onboarding.loginWait"));
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-bg text-fg">
      <div
        className="absolute inset-x-0 top-0 h-11 pl-[78px]"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      />
      <div
        data-tauri-drag-region="false"
        className="w-[440px] rounded-2xl border border-border bg-elevated p-6 shadow-[var(--shadow)]"
      >
        <div className="mb-1 text-[11px] uppercase tracking-[0.08em] text-subtle" data-tauri-drag-region>
          {t("app.name")}
        </div>
        <h1 className="text-[22px] font-medium tracking-tight">{t("onboarding.title")}</h1>
        <p className="mt-1 text-[13px] leading-6 text-muted">{t("onboarding.body")}</p>

        <ol className="mt-5 space-y-3 text-[13px]">
          <Step done={installed} label={t("onboarding.cli")}>
            {installed ? (
              <p className="font-mono text-[12px] text-muted">
                {status?.path} · {status?.version}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-muted">{t("onboarding.installHint")}</p>
                <code className="block rounded-lg border border-border bg-sidebar px-3 py-2 font-mono text-[11px]">
                  {INSTALL}
                </code>
              </div>
            )}
          </Step>
          <Step done={loggedIn} label={t("onboarding.auth")}>
            <p className="text-muted">
              {loggedIn ? t("onboarding.authed") : t("onboarding.authHint")}
            </p>
          </Step>
        </ol>

        <label className="mt-5 block">
          <div className="mb-1 text-[12px] text-muted">{t("onboarding.customPath")}</div>
          <input
            value={cliPath}
            onChange={(event) => setCliPath(event.target.value)}
            placeholder="~/.grok/bin/grok"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[12px] outline-none"
          />
        </label>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-[13px] hover:bg-hover"
            onClick={() => void recheck()}
            disabled={busy}
          >
            {t("onboarding.recheck")}
          </button>
          {installed && !loggedIn ? (
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] text-[var(--accent-fg)]"
              onClick={() => void login()}
              disabled={busy}
            >
              {t("onboarding.login")}
            </button>
          ) : null}
        </div>

        {note || status?.message ? (
          <p className="mt-3 text-[12px] text-muted">{note ?? status?.message}</p>
        ) : null}

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-subtle">
          <FolderOpen className="size-3" />
          {t("onboarding.footer")}
        </p>
      </div>
    </div>
  );
}

function Step({
  done,
  label,
  children,
}: {
  done: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 font-medium">
        <span
          className={`size-2 rounded-full ${done ? "bg-ok" : "bg-subtle"}`}
        />
        {label}
      </div>
      {children}
    </li>
  );
}
