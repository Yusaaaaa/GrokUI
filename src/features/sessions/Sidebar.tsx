import { useState } from "react";
import { startWindowDrag } from "@/lib/window-drag";
import { FolderOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickProjectFolder } from "@/features/chat/useAgentConnection";
import { translate } from "@/lib/i18n";
import { isStandaloneCwd } from "@/lib/paths";
import type { ProjectGroup as ProjectGroupType } from "@/lib/types";
import { useSessionStore } from "@/stores/session-store";
import { useSettingsStore } from "@/stores/settings-store";
import { AccountFooter } from "./AccountFooter";
import { ProjectGroup } from "./ProjectGroup";
import { SessionRow } from "./SessionRow";

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
  const removeProject = useSessionStore((state) => state.removeProject);
  const [pendingRemove, setPendingRemove] = useState<ProjectGroupType | null>(null);

  const needle = query.trim().toLowerCase();
  const workspaceProjects = projects.filter((project) => !isStandaloneCwd(project.cwd));
  const chatSessions = projects
    .filter((project) => isStandaloneCwd(project.cwd))
    .flatMap((project) => project.sessions);

  const filteredProjects = workspaceProjects
    .map((project) => ({
      ...project,
      sessions: project.sessions.filter((session) => {
        const haystack = `${session.title} ${session.preview} ${project.name}`.toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((project) => !needle || project.sessions.length > 0);

  const filteredChats = chatSessions.filter((session) => {
    const haystack = `${session.title} ${session.preview}`.toLowerCase();
    return haystack.includes(needle);
  });

  async function onOpenFolder() {
    const cwd = await pickProjectFolder();
    if (cwd) await openProject(cwd);
  }

  async function onDelete(id: string) {
    if (window.confirm(t("sidebar.deleteConfirm"))) {
      await removeSession(id);
    }
  }

  return (
    <aside className="relative flex h-full w-[268px] shrink-0 flex-col border-r border-white/10 bg-[color-mix(in_srgb,var(--bg-sidebar)_74%,transparent)] backdrop-blur-2xl">
      <div
        className="flex h-11 shrink-0 items-center justify-end px-2 pl-[78px]"
        data-tauri-drag-region
        onMouseDown={startWindowDrag}
      >
        <Button variant="icon" onClick={() => void onOpenFolder()} title={t("sidebar.openFolder")}>
          <FolderOpen className="size-4" />
        </Button>
      </div>

      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover"
          onClick={() => void createSession()}
        >
          <Plus className="size-4" />
          {t("sidebar.newChat")}
        </button>
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

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <div className="flex items-center justify-between px-4 pb-1 pt-2 text-[11px] font-medium tracking-[0.04em] text-subtle">
          <span>{t("sidebar.projects")}</span>
          <button
            type="button"
            className="rounded-md p-0.5 hover:bg-hover hover:text-fg"
            title={t("sidebar.openFolder")}
            onClick={() => void onOpenFolder()}
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        {filteredProjects.length === 0 ? (
          <p className="px-5 py-2 text-[12px] text-subtle">{t("sidebar.noProjectSessions")}</p>
        ) : (
          filteredProjects.map((project) => (
            <ProjectGroup
              key={project.id}
              project={project}
              activeSessionId={activeSessionId}
              onSelect={(id) => void openSession(id)}
              onDelete={(id) => void onDelete(id)}
              forceOpen={Boolean(needle)}
              onNew={() => void createSession(project.cwd)}
              onRemove={() => setPendingRemove(project)}
            />
          ))
        )}

        <div className="px-4 pb-1 pt-4 text-[11px] font-medium tracking-[0.04em] text-subtle">
          {t("sidebar.chats")}
        </div>
        {filteredChats.length === 0 ? (
          <p className="px-5 py-2 text-[12px] text-subtle">{t("sidebar.empty")}</p>
        ) : (
          <div className="flex flex-col gap-0.5 px-2">
            {filteredChats.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                onSelect={() => void openSession(session.id)}
                onDelete={() => void onDelete(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AccountFooter />

      {pendingRemove ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/25 p-3 backdrop-blur-[2px]">
          <div className="w-full rounded-xl border border-white/10 bg-[color-mix(in_srgb,var(--bg-elevated)_82%,transparent)] p-3 shadow-[var(--shadow)] backdrop-blur-xl">
            <div className="text-[13px] font-medium">{t("sidebar.removeTitle")}</div>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              {translate(locale, "sidebar.removeBody", {
                name: pendingRemove.name,
                count: String(pendingRemove.sessions.length),
              })}
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-left text-[12px] hover:bg-white/15"
                onClick={() => {
                  const cwd = pendingRemove.cwd;
                  setPendingRemove(null);
                  void removeProject(cwd, "move");
                }}
              >
                {t("sidebar.removeMove")}
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-left text-[12px] text-exec hover:bg-white/10"
                onClick={() => {
                  const cwd = pendingRemove.cwd;
                  setPendingRemove(null);
                  void removeProject(cwd, "delete");
                }}
              >
                {t("sidebar.removeDelete")}
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-left text-[12px] text-muted hover:bg-white/10"
                onClick={() => setPendingRemove(null)}
              >
                {t("sidebar.removeCancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
