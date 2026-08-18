export type PermissionMode = "ask" | "plan" | "auto" | "always";

export type ToolKind = "read" | "edit" | "execute" | "search";

export type ToolStatus = "pending" | "running" | "completed";

export type PlanStatus = "pending" | "in_progress" | "completed";

export interface DiffHunk {
  header: string;
  lines: Array<{ type: "ctx" | "add" | "del"; text: string }>;
}

export interface ChatBlock {
  id: string;
  type: "user" | "thought" | "text" | "tool" | "plan";
  text?: string;
  kind?: ToolKind;
  title?: string;
  status?: ToolStatus;
  detail?: string;
  path?: string;
  diff?: DiffHunk[];
  entries?: Array<{ id: string; content: string; status: PlanStatus }>;
}

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
  cwd: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  cwd: string;
  sessions: SessionSummary[];
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}
