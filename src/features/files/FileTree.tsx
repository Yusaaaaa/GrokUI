import { useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/cn";
import { listDir, onFsChanged, watchDir, type FsEntry } from "@/lib/tauri";
import { useAppStore } from "@/stores/app-store";

export function FileTree({ root }: { root: string }) {
  const [children, setChildren] = useState<Record<string, FsEntry[]>>({});
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef<Set<string>>(new Set());
  const previewPath = useAppStore((state) => state.previewPath);
  const setPreviewPath = useAppStore((state) => state.setPreviewPath);

  async function load(path: string) {
    const entries = await listDir(path);
    loaded.current.add(path);
    setChildren((current) => ({ ...current, [path]: entries }));
  }

  useEffect(() => {
    let cancelled = false;
    loaded.current = new Set();
    setChildren({});
    if (!root) return;
    void watchDir(root).catch(() => undefined);
    void listDir(root)
      .then((entries) => {
        if (cancelled) return;
        loaded.current.add(root);
        setChildren({ [root]: entries });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [root]);

  useEffect(() => {
    let timer: number | undefined;
    const unlisten = onFsChanged((payload) => {
      const paths = payload.paths ?? [];
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const reloadSet = new Set<string>();
        for (const changed of paths) {
          const parent = parentDir(changed);
          if (loaded.current.has(parent)) reloadSet.add(parent);
          if (loaded.current.has(changed)) reloadSet.add(changed);
        }
        for (const dir of reloadSet) void reload(dir);
        if (
          previewPath &&
          paths.some((item) => previewPath === item || previewPath.startsWith(`${item}/`))
        ) {
          void listDir(parentDir(previewPath))
            .then((entries) => {
              if (!entries.some((entry) => entry.path === previewPath)) {
                setPreviewPath(null);
              }
            })
            .catch(() => setPreviewPath(null));
        }
      }, 200);
    });
    return () => {
      window.clearTimeout(timer);
      void unlisten.then((stop) => stop());
    };
  }, [previewPath, setPreviewPath]);

  async function reload(path: string) {
    try {
      const entries = await listDir(path);
      setChildren((current) => ({ ...current, [path]: entries }));
    } catch {
      loaded.current.delete(path);
      setChildren((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
    }
  }

  async function ensure(path: string) {
    if (loaded.current.has(path)) return;
    await load(path);
  }

  if (!root) return null;
  if (error) return <p className="px-3 py-2 text-[12px] text-exec">{error}</p>;

  return (
    <div className="px-1 py-1">
      {(children[root] ?? []).map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          childrenMap={children}
          onEnsure={ensure}
        />
      ))}
    </div>
  );
}

function parentDir(path: string): string {
  const index = path.lastIndexOf("/");
  return index > 0 ? path.slice(0, index) : path;
}

function TreeNode({
  node,
  depth,
  childrenMap,
  onEnsure,
}: {
  node: FsEntry;
  depth: number;
  childrenMap: Record<string, FsEntry[]>;
  onEnsure: (path: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(depth < 0);
  const previewPath = useAppStore((state) => state.previewPath);
  const setPreviewPath = useAppStore((state) => state.setPreviewPath);
  const isDir = node.type === "dir";
  const active = previewPath === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (isDir) {
            const next = !open;
            setOpen(next);
            if (next) void onEnsure(node.path);
          } else {
            setPreviewPath(node.path);
          }
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px]",
          active ? "bg-active text-fg" : "text-muted hover:bg-hover hover:text-fg",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isDir ? (
          <ChevronRight className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        ) : (
          <span className="w-3" />
        )}
        {isDir ? <Folder className="size-3.5 shrink-0" /> : <FileText className="size-3.5 shrink-0" />}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open
        ? (childrenMap[node.path] ?? []).map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              onEnsure={onEnsure}
            />
          ))
        : null}
    </div>
  );
}
