import { FolderOpen } from "lucide-react";
import { SessionRow } from "./SessionRow";
import type { ProjectGroup as ProjectGroupType } from "@/lib/types";

interface ProjectGroupProps {
  project: ProjectGroupType;
  activeSessionId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectGroup({
  project,
  activeSessionId,
  onSelect,
  onDelete,
}: ProjectGroupProps) {
  return (
    <section className="px-2">
      <div className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-[11px] font-medium tracking-[0.04em] text-subtle">
        <FolderOpen className="size-3" />
        <span className="truncate">{project.name}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {project.sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            onSelect={() => onSelect(session.id)}
            onDelete={() => onDelete(session.id)}
          />
        ))}
      </div>
    </section>
  );
}
