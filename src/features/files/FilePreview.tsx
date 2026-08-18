import { useEffect, useState } from "react";
import { translate } from "@/lib/i18n";
import { onFsChanged, previewFile, type FilePreviewData } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";
import { useActiveProject } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";

function resolvePath(path: string, cwd?: string) {
  if (path.startsWith("/")) return path;
  if (!cwd) return path;
  return `${cwd.replace(/\/$/, "")}/${path}`;
}

export function FilePreview() {
  const locale = useSettingsStore((state) => state.locale);
  const rawPath = useAppStore((state) => state.previewPath);
  const filesRoot = useSettingsStore((state) => state.filesRoot);
  const project = useActiveProject();
  const path = rawPath ? resolvePath(rawPath, project?.cwd ?? filesRoot) : null;
  const [data, setData] = useState<FilePreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    void previewFile(path)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => {
    if (!path) return;
    const unlisten = onFsChanged((payload) => {
      const paths = payload.paths ?? [];
      if (!paths.some((item) => path === item || path.startsWith(`${item}/`))) return;
      void previewFile(path).catch(() => {
        setData(null);
        setError(null);
      });
    });
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border">
      <div className="px-3 py-2 text-[11px] uppercase tracking-[0.06em] text-subtle">
        {translate(locale, "files.preview")}
      </div>
      {loading ? (
        <p className="px-3 text-[12px] text-subtle">{translate(locale, "files.loading")}</p>
      ) : error ? (
        <p className="px-3 text-[12px] text-exec">{error}</p>
      ) : data?.kind === "text" && data.content ? (
        <pre className="min-h-0 flex-1 overflow-auto px-3 pb-3 font-mono text-[11.5px] leading-5 text-muted">
          <div className="mb-2 text-[11px] text-subtle">{data.path}</div>
          {data.content}
        </pre>
      ) : data?.kind === "image" && data.content ? (
        <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          <div className="mb-2 text-[11px] text-subtle">{data.path}</div>
          <img src={data.content} alt={data.name} className="max-w-full rounded-md" />
        </div>
      ) : data ? (
        <p className="px-3 text-[12px] text-subtle">{translate(locale, "files.binary")}</p>
      ) : (
        <p className="px-3 text-[12px] text-subtle">{translate(locale, "files.empty")}</p>
      )}
    </div>
  );
}
