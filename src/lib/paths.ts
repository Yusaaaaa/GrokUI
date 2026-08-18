export const STANDALONE_MARKER = "Grok Build/Chats";

export function isStandaloneCwd(cwd: string | null | undefined): boolean {
  if (!cwd) return false;
  return cwd.includes(STANDALONE_MARKER);
}
