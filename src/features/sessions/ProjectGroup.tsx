import { ChevronRight, FolderOpen, Plus, Trash2 } from "lucide-react";
import { SessionRow } from "./SessionRow";
import type { ProjectGroup as ProjectGroupType } from "@/lib/types";
import { translate } from "@/lib/i18n";
import { useSettingsStore } from "@/stores/settings-store";

interface ProjectGroupProps {
  project: ProjectGroupType;
  activeSessionId: string;
  forceOpen?: boolean;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
  onDelete: (id: string) => void;
  onNew?: () => void;
  onRemove?: () => void;
}

export function ProjectGroup({
  project,
  activeSessionId,
  forceOpen = false,
  onSelect,
  onPrefetch,
  onDelete,
  onNew,
  onRemove,
}: ProjectGroupProps) {
  const locale = useSettingsStore((state) => state.locale);
  const explicit = useSettingsStore((state) => state.projectExpanded[project.cwd]);
  const setProjectExpanded = useSettingsStore((state) => state.setProjectExpanded);
  const hasActive = project.sessions.some((session) => session.id === activeSessionId);
  const expanded = forceOpen || (explicit ?? hasActive);

  return (
    <section className="px-2">
      <div className="flex items-center gap-1 px-1 pb-1 pt-3 text-[11px] font-medium tracking-[0.04em] text-subtle">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-hover hover:text-fg"
          title={project.cwd}
          aria-expanded={expanded}
          onClick={() => setProjectExpanded(project.cwd, !expanded)}
        >
          <ChevronRight
            className={`size-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
          <FolderOpen className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{project.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-subtle">
            {project.sessions.length}
          </span>
        </button>
        {onNew ? (
          <button
            type="button"
            className="rounded-md p-0.5 hover:bg-hover hover:text-fg"
            title={translate(locale, "sidebar.newInProject")}
            onClick={onNew}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="rounded-md p-0.5 hover:bg-hover hover:text-exec"
            title={translate(locale, "sidebar.removeProject")}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="flex flex-col gap-0.5">
          {project.sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              onSelect={() => onSelect(session.id)}
              onPrefetch={onPrefetch ? () => onPrefetch(session.id) : undefined}
              onDelete={() => onDelete(session.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
