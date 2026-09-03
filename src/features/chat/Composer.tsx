import { useRef } from "react";
import { Square } from "lucide-react";
import { ArrowUp, ImagePlus, Paperclip, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { ModeSelect } from "@/features/settings/ModeSelect";
import { ModelSelect } from "@/features/settings/ModelSelect";
import { translate } from "@/lib/i18n";
import { isTauri } from "@/lib/tauri";
import {
  EMPTY_FILES,
  useActiveBusy,
  useSessionStore,
} from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

function isImeKey(event: { nativeEvent: { isComposing?: boolean }; keyCode: number }) {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export function Composer() {
  const imeRef = useRef(false);
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sessionId = useSessionStore((state) => state.activeSessionId);
  const draft = useSessionStore((state) => state.drafts[sessionId] ?? "");
  const files = useSessionStore(
    (state) => state.attachments[sessionId] ?? EMPTY_FILES,
  );
  const setDraft = useSessionStore((state) => state.setDraft);
  const sendDraft = useSessionStore((state) => state.sendDraft);
  const stopActive = useSessionStore((state) => state.stopActive);
  const addAttachment = useSessionStore((state) => state.addAttachment);
  const removeAttachment = useSessionStore((state) => state.removeAttachment);
  const connecting = useSessionStore((state) => state.connecting);
  const agentReady = useSessionStore((state) => Boolean(state.loadedOnAgent[state.activeSessionId]));
  const busy = useActiveBusy();

  async function pick(kind: "file" | "image") {
    if (!isTauri()) return;
    const selected = await open({
      multiple: true,
      directory: false,
      filters:
        kind === "image"
          ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }]
          : undefined,
    });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    for (const path of paths) addAttachment(path);
  }

  const canSend =
    Boolean(sessionId) &&
    !connecting &&
    agentReady &&
    (!!draft.trim() || files.length > 0);

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pb-5">
      <div className="rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--bg-composer)_72%,transparent)] shadow-[var(--shadow)] backdrop-blur-2xl">
        {files.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
            {files.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-elevated px-2 py-1 text-[12px]"
              >
                {name.split("/").pop()}
                <button type="button" onClick={() => removeAttachment(name)}>
                  <X className="size-3 text-subtle" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionStart={() => {
            imeRef.current = true;
          }}
          onCompositionEnd={() => {
            imeRef.current = true;
            window.setTimeout(() => {
              imeRef.current = false;
            }, 0);
          }}
          onKeyDown={(event) => {
            if (imeRef.current || isImeKey(event)) return;
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (busy) void stopActive();
              else if (canSend) void sendDraft();
            }
            if (event.key === "Escape" && busy) {
              event.preventDefault();
              void stopActive();
            }
          }}
          rows={2}
          placeholder={t("composer.placeholder")}
          className="block max-h-40 min-h-[72px] w-full bg-transparent px-4 pt-3 text-[14px] text-fg outline-none placeholder:text-subtle"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="icon" title={t("composer.attach")} onClick={() => void pick("file")}>
              <Paperclip className="size-4" />
            </Button>
            <Button variant="icon" title={t("composer.image")} onClick={() => void pick("image")}>
              <ImagePlus className="size-4" />
            </Button>
            <ModeSelect />
          </div>
          <div className="flex items-center gap-1.5">
            <ModelSelect />
          {busy ? (
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)]"
              onClick={() => void stopActive()}
              title={t("composer.stop")}
            >
              <Square className="size-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] transition-opacity disabled:opacity-30"
              onClick={() => void sendDraft()}
              disabled={!canSend}
              title={t("composer.send")}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-subtle">{t("composer.hint")}</p>
    </div>
  );
}
