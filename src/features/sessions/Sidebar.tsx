import { startWindowDrag } from "@/lib/window-drag";
import { FolderOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickProjectFolder } from "@/features/chat/useAgentConnection";
import { translate } from "@/lib/i18n";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { ProjectGroup } from "./ProjectGroup";

export function Sidebar() {
  const locale = useSettingsStore((state) => state.locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const projects = useSessionStore((state) => state.projects);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const query = useSessionStore((state) => state.query);
  const setQuery = useSessionStore((state) => state.setQuery);
  const openSession = useSessionStore((state) => state.openSession);
  const createSession = useSessionStore((state) => state.createSession);
  const openProject = useSessionStore((state) => state.openProject);
  const removeSession = useSessionStore((state) => state.removeSession);

  const filtered = projects
    .map((project) => ({
      ...project,
      sessions: project.sessions.filter((session) => {
        const haystack = `${session.title} ${session.preview} ${project.name}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      }),
    }))
    .filter((project) => project.sessions.length > 0);

  async function onOpenFolder() {
    const cwd = await pickProjectFolder();
    if (cwd) await openProject(cwd);
  }

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div
        className="flex items-end justify-between px-3 pb-2 pt-3"
        onMouseDown={startWindowDrag}
      >
        <div>
          <div className="text-[15px] font-semibold tracking-tight">{t("app.name")}</div>
          <div className="text-[11px] text-subtle">{t("app.tagline")}</div>
        </div>
        <div className="flex items-center">
          <Button variant="icon" onClick={() => void onOpenFolder()} title={t("sidebar.openFolder")}>
            <FolderOpen className="size-4" />
          </Button>
          <Button variant="icon" onClick={() => void createSession()} title={t("sidebar.newChat")}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2.5 py-1.5 text-muted">
          <Search className="size-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("sidebar.search")}
            className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {filtered.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-subtle">{t("sidebar.empty")}</p>
        ) : (
          filtered.map((project) => (
            <ProjectGroup
              key={project.id}
              project={project}
              activeSessionId={activeSessionId}
              onSelect={(id) => void openSession(id)}
              onDelete={(id) => {
                if (window.confirm(t("sidebar.deleteConfirm"))) {
                  void removeSession(id);
                }
              }}
            />
          ))
        )}
      </div>
    </aside>
  );
}
