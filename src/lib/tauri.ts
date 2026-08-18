import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppInfo {
  name: string;
  version: string;
  phase: string;
}

export interface AccountProfile {
  displayName?: string | null;
  email?: string | null;
}

export interface CliStatus {
  installed: boolean;
  loggedIn: boolean;
  path: string | null;
  version: string | null;
  defaultCwd: string;
  standaloneDir?: string;
  account?: AccountProfile | null;
  message: string;
}

export interface SessionCreated {
  sessionId: string;
  models?: {
    currentModelId?: string;
    availableModels?: Array<{ modelId: string; name?: string }>;
  };
}

export interface PermissionOption {
  optionId: string;
  name: string;
  kind?: string;
}

export interface PermissionRequest {
  requestId: number;
  sessionId?: string;
  options?: PermissionOption[];
  toolCall?: {
    toolCallId?: string;
    title?: string;
    kind?: string;
    status?: string;
    rawInput?: Record<string, unknown>;
  };
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getAppInfo(): Promise<AppInfo | null> {
  if (!isTauri()) return null;
  try {
    return await invoke<AppInfo>("app_info");
  } catch {
    return null;
  }
}

export async function cliStatus(cliPath?: string | null): Promise<CliStatus> {
  return invoke<CliStatus>("cli_status", { cliPath: cliPath || null });
}

export async function startLogin(cliPath?: string | null): Promise<string> {
  return invoke<string>("start_login", { cliPath: cliPath || null });
}

export async function ensureDir(path: string): Promise<string> {
  return invoke<string>("ensure_dir", { path });
}

export async function startAgent(
  cliPath?: string | null,
  model?: string | null,
  force = false,
): Promise<CliStatus> {
  return invoke<CliStatus>("start_agent", {
    cliPath: cliPath || null,
    model: model || null,
    force,
  });
}

export async function newSession(
  cwd: string,
  yolo: boolean,
  model?: string | null,
): Promise<SessionCreated> {
  return invoke<SessionCreated>("new_session", {
    cwd,
    yolo,
    model: model || null,
  });
}

export async function sendPrompt(sessionId: string, text: string): Promise<unknown> {
  return invoke("send_prompt", { sessionId, text });
}

export async function cancelPrompt(sessionId: string): Promise<void> {
  await invoke("cancel_prompt", { sessionId });
}

export async function resolvePermission(
  requestId: number,
  optionId: string | null,
): Promise<void> {
  await invoke("resolve_permission", { requestId, optionId });
}

export interface DiskSession {
  id: string;
  cwd: string;
  title: string;
  preview: string;
  updatedAt: string;
  createdAt: string;
}

export interface HistoryBlock {
  id: string;
  type: ChatBlockType;
  text?: string;
  kind?: string;
  title?: string;
  status?: string;
  path?: string;
  detail?: string;
}

type ChatBlockType = "user" | "thought" | "text" | "tool" | "plan";

export interface FsEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface FilePreviewData {
  path: string;
  name: string;
  kind: "text" | "image" | "binary" | "pdf";
  content: string | null;
  mime: string | null;
}

export async function listSessions(): Promise<DiskSession[]> {
  return invoke("list_sessions");
}

export async function sessionHistory(sessionId: string): Promise<HistoryBlock[]> {
  return invoke("session_history", { sessionId });
}

export async function deleteSession(
  sessionId: string,
  cliPath?: string | null,
): Promise<void> {
  await invoke("delete_session", { sessionId, cliPath: cliPath || null });
}

export async function relocateSessions(
  sessionIds: string[],
  targetCwd: string,
): Promise<void> {
  await invoke("relocate_sessions", { sessionIds, targetCwd });
}

export async function loadSession(
  sessionId: string,
  cwd: string,
  yolo: boolean,
): Promise<unknown> {
  return invoke("load_session", { sessionId, cwd, yolo });
}

export async function listDir(path: string): Promise<FsEntry[]> {
  return invoke("list_dir", { path });
}

export async function previewFile(path: string): Promise<FilePreviewData> {
  return invoke("preview_file", { path });
}

export async function watchDir(path: string): Promise<void> {
  await invoke("watch_dir", { path });
}

export interface DayUsage {
  date: string;
  day: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  total: number;
  turns: number;
}

export interface MonthUsage {
  year: number;
  month: number;
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  total: number;
  turns: number;
  days: DayUsage[];
}

export async function monthUsage(year?: number, month?: number): Promise<MonthUsage> {
  return invoke("month_usage", { year: year ?? null, month: month ?? null });
}

export function onFsChanged(
  handler: (payload: { paths?: string[] }) => void,
): Promise<UnlistenFn> {
  return listen<{ paths?: string[] }>("fs://changed", (event) => {
    handler(event.payload);
  });
}

export function onSessionUpdate(
  handler: (payload: Record<string, unknown>) => void,
): Promise<UnlistenFn> {
  return listen<Record<string, unknown>>("session://update", (event) => {
    handler(event.payload);
  });
}

export function onPermissionAsk(
  handler: (payload: PermissionRequest) => void,
): Promise<UnlistenFn> {
  return listen<PermissionRequest>("permission://ask", (event) => {
    handler(event.payload);
  });
}

export function onAgentStatus(
  handler: (payload: { state?: string; message?: string }) => void,
): Promise<UnlistenFn> {
  return listen("agent://status", (event) => {
    handler(event.payload as { state?: string; message?: string });
  });
}

export function onModelsUpdate(
  handler: (payload: Record<string, unknown>) => void,
): Promise<UnlistenFn> {
  return listen<Record<string, unknown>>("models://update", (event) => {
    handler(event.payload);
  });
}

export function onTurnEnd(
  handler: (payload: {
    sessionId?: string;
    ok?: boolean;
    error?: string;
  }) => void,
): Promise<UnlistenFn> {
  return listen("session://turn", (event) => {
    handler(event.payload as { sessionId?: string; ok?: boolean; error?: string });
  });
}
