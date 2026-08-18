import type { ChatBlock, PlanStatus, ToolKind, ToolStatus } from "./types";

export function applySessionUpdate(
  blocks: ChatBlock[],
  payload: Record<string, unknown>,
): ChatBlock[] {
  const update = (payload.update as Record<string, unknown> | undefined) ?? payload;
  const kind = String(update.sessionUpdate ?? "");

  if (kind === "user_message_chunk") {
    const chunk = textOf(update);
    const last = blocks[blocks.length - 1];
    if (last?.type === "user" && chunk && (last.text ?? "").includes(chunk)) {
      return blocks;
    }
    return appendText(blocks, "user", chunk);
  }

  if (kind === "agent_thought_chunk") {
    return appendText(blocks, "thought", textOf(update));
  }

  if (kind === "agent_message_chunk") {
    return appendText(blocks, "text", textOf(update));
  }

  if (kind === "tool_call") {
    const id = String(update.toolCallId ?? `tool-${Date.now()}`);
    const next = blocks.filter((block) => block.id !== id);
    next.push(toolFromUpdate(id, update));
    return next;
  }

  if (kind === "tool_call_update") {
    const id = String(update.toolCallId ?? "");
    return blocks.map((block) =>
      block.id === id ? { ...block, ...toolFromUpdate(id, update) } : block,
    );
  }

  if (kind === "plan") {
    const entries = Array.isArray(update.entries)
      ? (update.entries as Array<Record<string, unknown>>).map((entry, index) => ({
          id: String(entry.id ?? index),
          content: String(entry.content ?? entry.title ?? ""),
          status: planStatus(entry.status),
        }))
      : [];
    const existing = blocks.findIndex((block) => block.type === "plan");
    const plan: ChatBlock = { id: "plan", type: "plan", entries };
    if (existing >= 0) {
      const copy = [...blocks];
      copy[existing] = plan;
      return copy;
    }
    return [...blocks, plan];
  }

  return blocks;
}

function appendText(
  blocks: ChatBlock[],
  type: "user" | "thought" | "text",
  chunk: string,
): ChatBlock[] {
  if (!chunk) return blocks;
  const last = blocks[blocks.length - 1];
  if (last && last.type === type) {
    return [...blocks.slice(0, -1), { ...last, text: `${last.text ?? ""}${chunk}` }];
  }
  return [...blocks, { id: `${type}-${Date.now()}-${blocks.length}`, type, text: chunk }];
}

function textOf(update: Record<string, unknown>): string {
  const content = update.content as Record<string, unknown> | undefined;
  if (content && typeof content.text === "string") return content.text;
  if (typeof update.text === "string") return update.text;
  return "";
}

function toolFromUpdate(id: string, update: Record<string, unknown>): ChatBlock {
  const raw = (update.rawInput as Record<string, unknown> | undefined) ?? {};
  const path =
    (typeof raw.path === "string" && raw.path) ||
    (typeof raw.file === "string" && raw.file) ||
    undefined;
  const command = typeof raw.command === "string" ? raw.command : undefined;
  return {
    id,
    type: "tool",
    kind: toolKind(update.kind, update),
    title: String(update.title ?? update.toolName ?? "Tool"),
    status: toolStatus(update.status),
    path,
    detail: command ?? (path ? undefined : previewInput(raw)),
  };
}

function previewInput(raw: Record<string, unknown>): string | undefined {
  const keys = Object.keys(raw);
  if (keys.length === 0) return undefined;
  try {
    return JSON.stringify(raw);
  } catch {
    return undefined;
  }
}

function toolKind(value: unknown, update?: Record<string, unknown>): ToolKind {
  const meta = update?._meta as Record<string, unknown> | undefined;
  const nested = meta?.["x.ai/tool"] as Record<string, unknown> | undefined;
  const kind = String(value ?? nested?.kind ?? "");
  if (kind === "edit" || kind === "delete" || kind === "move") return "edit";
  if (kind === "execute") return "execute";
  if (kind === "search" || kind === "fetch") return "search";
  return "read";
}

function toolStatus(value: unknown): ToolStatus {
  const status = String(value ?? "");
  if (status === "completed" || status === "failed") return "completed";
  if (status === "in_progress" || status === "running") return "running";
  return "pending";
}

function planStatus(value: unknown): PlanStatus {
  const status = String(value ?? "");
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  return "pending";
}
