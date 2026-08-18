import { create } from "zustand";
import { applySessionUpdate } from "@/lib/acp-reducer";
import {
  cancelPrompt,
  deleteSession as deleteDiskSession,
  listSessions,
  loadSession,
  newSession,
  sendPrompt,
  sessionHistory,
  type HistoryBlock,
} from "@/lib/tauri";
import type { ChatBlock, PlanStatus, ProjectGroup, SessionSummary, ToolKind, ToolStatus } from "@/lib/types";
import { useSettingsStore } from "./settings-store";

const EMPTY_FILES: string[] = [];
const EMPTY_BLOCKS: ChatBlock[] = [];

interface SessionState {
  projects: ProjectGroup[];
  activeSessionId: string;
  transcripts: Record<string, ChatBlock[]>;
  drafts: Record<string, string>;
  attachments: Record<string, string[]>;
  busy: Record<string, boolean>;
  query: string;
  streamTick: number;
  connecting: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  selectSession: (id: string) => void;
  setDraft: (text: string) => void;
  addAttachment: (name: string) => void;
  removeAttachment: (name: string) => void;
  applyUpdate: (sessionId: string, payload: Record<string, unknown>) => void;
  setBusy: (sessionId: string, busy: boolean) => void;
  setError: (error: string | null) => void;
  loadedOnAgent: Record<string, boolean>;
  sendDraft: () => Promise<void>;
  stopActive: () => Promise<void>;
  createSession: (cwd?: string) => Promise<void>;
  openProject: (cwd: string) => Promise<void>;
  hydrateFromDisk: () => Promise<void>;
  indexFromDisk: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
}

function projectName(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function upsertProject(projects: ProjectGroup[], cwd: string): ProjectGroup[] {
  const existing = projects.find((project) => project.cwd === cwd);
  if (existing) return projects;
  return [
    {
      id: cwd,
      name: projectName(cwd),
      cwd,
      sessions: [],
    },
    ...projects,
  ];
}

export const useSessionStore = create<SessionState>((set, get) => ({
  projects: [],
  activeSessionId: "",
  transcripts: {},
  drafts: {},
  attachments: {},
  busy: {},
  query: "",
  streamTick: 0,
  connecting: false,
  error: null,
  loadedOnAgent: {},
  setQuery: (query) => set({ query }),
  selectSession: (id) => set({ activeSessionId: id }),
  setDraft: (text) => {
    const { activeSessionId } = get();
    set((state) => ({
      drafts: { ...state.drafts, [activeSessionId]: text },
    }));
  },
  addAttachment: (name) => {
    const { activeSessionId } = get();
    set((state) => {
      const current = state.attachments[activeSessionId] ?? [];
      if (current.includes(name)) return state;
      return {
        attachments: {
          ...state.attachments,
          [activeSessionId]: [...current, name],
        },
      };
    });
  },
  removeAttachment: (name) => {
    const { activeSessionId } = get();
    set((state) => ({
      attachments: {
        ...state.attachments,
        [activeSessionId]: (state.attachments[activeSessionId] ?? []).filter(
          (item) => item !== name,
        ),
      },
    }));
  },
  applyUpdate: (sessionId, payload) => {
    set((state) => ({
      streamTick: state.streamTick + 1,
      transcripts: {
        ...state.transcripts,
        [sessionId]: applySessionUpdate(state.transcripts[sessionId] ?? [], payload),
      },
    }));
  },
  setBusy: (sessionId, busy) => {
    set((state) => ({
      busy: { ...state.busy, [sessionId]: busy },
    }));
  },
  setError: (error) => set({ error }),
  sendDraft: async () => {
    const { activeSessionId, drafts, attachments } = get();
    if (!activeSessionId || get().busy[activeSessionId]) return;
    const text = (drafts[activeSessionId] ?? "").trim();
    const files = attachments[activeSessionId] ?? [];
    if (!text && files.length === 0) return;
    const refs = files.map((path) => `@${path}`).join(" ");
    const body = [text, refs].filter(Boolean).join("\n\n");

    set((state) => ({
      drafts: { ...state.drafts, [activeSessionId]: "" },
      attachments: { ...state.attachments, [activeSessionId]: [] },
      busy: { ...state.busy, [activeSessionId]: true },
      error: null,
      streamTick: state.streamTick + 1,
      transcripts: {
        ...state.transcripts,
        [activeSessionId]: [
          ...(state.transcripts[activeSessionId] ?? []),
          { id: `user-${Date.now()}`, type: "user", text: body },
        ],
      },
      projects: state.projects.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                preview: text || session.preview,
                title: session.title === "New chat" ? text.slice(0, 42) : session.title,
                updatedAt: "today",
              }
            : session,
        ),
      })),
    }));

    try {
      await sendPrompt(activeSessionId, body);
    } catch (error) {
      set((state) => ({
        busy: { ...state.busy, [activeSessionId]: false },
        error: error instanceof Error ? error.message : String(error),
        transcripts: {
          ...state.transcripts,
          [activeSessionId]: [
            ...(state.transcripts[activeSessionId] ?? []),
            {
              id: `err-${Date.now()}`,
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
        },
      }));
    }
  },
  stopActive: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    try {
      await cancelPrompt(activeSessionId);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  createSession: async (cwd) => {
    const settings = useSettingsStore.getState();
    const target = cwd ?? settings.lastCwd;
    if (!target) {
      set({ error: "Pick a project folder first." });
      return;
    }
    set({ connecting: true, error: null });
    try {
      const created = await newSession(
        target,
        settings.permissionMode === "always",
        settings.model,
      );
      const id = created.sessionId;
      settings.setLastCwd(target);
      if (created.models?.availableModels?.length) {
        settings.setModels(created.models.availableModels.map((item) => item.modelId));
      }
      if (created.models?.currentModelId) {
        settings.setModel(created.models.currentModelId);
      }
      set((state) => {
        const projects = upsertProject(state.projects, target).map((project) =>
          project.cwd === target
            ? {
                ...project,
                sessions: [
                  {
                    id,
                    title: "New chat",
                    updatedAt: new Date().toISOString(),
                    preview: "",
                    cwd: target,
                  },
                  ...project.sessions,
                ],
              }
            : project,
        );
        return {
          connecting: false,
          activeSessionId: id,
          projects,
          transcripts: { ...state.transcripts, [id]: [] },
          loadedOnAgent: { ...state.loadedOnAgent, [id]: true },
        };
      });
    } catch (error) {
      set({
        connecting: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  openProject: async (cwd) => {
    await get().createSession(cwd);
  },
  indexFromDisk: async () => {
    try {
      const listed = await listSessions();
      const projects = groupSessions(listed);
      const settings = useSettingsStore.getState();
      const preferredCwd = settings.lastCwd;
      const preferred =
        listed.find((item) => item.cwd === preferredCwd) ?? listed[0];
      set({
        projects,
        activeSessionId: preferred?.id ?? get().activeSessionId,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },
  hydrateFromDisk: async () => {
    await get().indexFromDisk();
    const id = get().activeSessionId;
    if (id) void get().openSession(id);
  },
  openSession: async (id) => {
    const existing = findSession(get().projects, id);
    if (!existing) {
      set({ activeSessionId: id });
      return;
    }
    set({ connecting: true, error: null, activeSessionId: id });
    const settings = useSettingsStore.getState();
    settings.setLastCwd(existing.cwd);
    try {
      if (!get().transcripts[id]) {
        const history = await sessionHistory(id);
        set((state) => ({
          transcripts: {
            ...state.transcripts,
            [id]: history.map(historyToBlock),
          },
        }));
      }
      if (!get().loadedOnAgent[id]) {
        await loadSession(id, existing.cwd, settings.permissionMode === "always");
        set((state) => ({
          loadedOnAgent: { ...state.loadedOnAgent, [id]: true },
        }));
      }
      set({ connecting: false, activeSessionId: id, streamTick: get().streamTick + 1 });
    } catch (error) {
      set({
        connecting: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  removeSession: async (id) => {
    const settings = useSettingsStore.getState();
    await deleteDiskSession(id, settings.cliPath || null);
    set((state) => {
      const projects = state.projects
        .map((project) => ({
          ...project,
          sessions: project.sessions.filter((session) => session.id !== id),
        }))
        .filter((project) => project.sessions.length > 0);
      const transcripts = { ...state.transcripts };
      delete transcripts[id];
      const loadedOnAgent = { ...state.loadedOnAgent };
      delete loadedOnAgent[id];
      const activeSessionId =
        state.activeSessionId === id
          ? (projects[0]?.sessions[0]?.id ?? "")
          : state.activeSessionId;
      return { projects, transcripts, loadedOnAgent, activeSessionId };
    });
  },
}));

function groupSessions(listed: Array<{
  id: string;
  cwd: string;
  title: string;
  preview: string;
  updatedAt: string;
}>): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const item of listed) {
    const cwd = item.cwd || "unknown";
    const current = map.get(cwd) ?? {
      id: cwd,
      name: projectName(cwd),
      cwd,
      sessions: [] as SessionSummary[],
    };
    current.sessions.push({
      id: item.id,
      title: item.title || "Untitled",
      preview: item.preview,
      updatedAt: item.updatedAt,
      cwd,
    });
    map.set(cwd, current);
  }
  return [...map.values()];
}

function findSession(
  projects: ProjectGroup[],
  id: string,
): SessionSummary | undefined {
  for (const project of projects) {
    const found = project.sessions.find((session) => session.id === id);
    if (found) return found;
  }
  return undefined;
}

function historyToBlock(block: HistoryBlock): ChatBlock {
  const entries =
    block.type === "plan" && block.text
      ? block.text.split("\n").filter(Boolean).map((content, index) => ({
          id: `${block.id}-${index}`,
          content,
          status: "completed" as PlanStatus,
        }))
      : undefined;
  return {
    id: block.id,
    type: block.type,
    text: block.text,
    kind: (block.kind as ToolKind | undefined) ?? undefined,
    title: block.title,
    status: (block.status as ToolStatus | undefined) ?? undefined,
    path: block.path,
    detail: block.detail,
    entries,
  };
}

export function useActiveTranscript(): ChatBlock[] {
  const id = useSessionStore((state) => state.activeSessionId);
  useSessionStore((state) => state.streamTick);
  return useSessionStore((state) => state.transcripts[id] ?? EMPTY_BLOCKS);
}

export function useActiveProject(): ProjectGroup | undefined {
  const id = useSessionStore((state) => state.activeSessionId);
  return useSessionStore((state) =>
    state.projects.find((project) =>
      project.sessions.some((session) => session.id === id),
    ),
  );
}

export function useActiveBusy(): boolean {
  const id = useSessionStore((state) => state.activeSessionId);
  return useSessionStore((state) => Boolean(state.busy[id]));
}

export { EMPTY_FILES };
