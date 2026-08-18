import type { ChatBlock, FileNode, ProjectGroup } from "./types";

export const mockProjects: ProjectGroup[] = [
  {
    id: "grokui",
    name: "GrokUI",
    cwd: "/Users/yusa/GrokWorkSpace/GrokUI",
    sessions: [
      {
        id: "s-shell",
        title: "Desktop client shell",
        updatedAt: "today",
        preview: "Three-column layout, theme, and i18n",
        cwd: "/Users/yusa/GrokWorkSpace/GrokUI",
      },
      {
        id: "s-empty",
        title: "Empty conversation",
        updatedAt: "today",
        preview: "Start something new",
        cwd: "/Users/yusa/GrokWorkSpace/GrokUI",
      },
    ],
  },
  {
    id: "workspace",
    name: "GrokWorkSpace",
    cwd: "/Users/yusa/GrokWorkSpace",
    sessions: [
      {
        id: "s-news",
        title: "Financial news workflow",
        updatedAt: "yesterday",
        preview: "Generate today's daily report",
        cwd: "/Users/yusa/GrokWorkSpace",
      },
    ],
  },
];

export const mockTranscript: Record<string, ChatBlock[]> = {
  "s-shell": [
    {
      id: "u1",
      type: "user",
      text: "帮我从零做一个 Claude Desktop 风格的 Grok Build 桌面客户端。先把三栏空壳和主题做出来。",
    },
    {
      id: "t1",
      type: "thought",
      text: "需要一个本地桌面壳，而不是再实现一套 agent。Tauri 2 更适合托管 grok agent stdio。这一步只做可运行窗口：侧栏、对话区、文件树、输入框，以及深浅色和中英文。",
    },
    {
      id: "p1",
      type: "plan",
      entries: [
        { id: "p1a", content: "Scaffold Tauri 2 + React + TypeScript", status: "completed" },
        { id: "p1b", content: "Build the three-column shell and design tokens", status: "in_progress" },
        { id: "p1c", content: "Connect grok agent stdio over ACP", status: "pending" },
      ],
    },
    {
      id: "k1",
      type: "tool",
      kind: "search",
      title: "Search ACP session APIs",
      status: "completed",
      detail: "session/new · session/prompt · session/request_permission",
    },
    {
      id: "k2",
      type: "tool",
      kind: "read",
      title: "Read src-tauri/tauri.conf.json",
      status: "completed",
      path: "src-tauri/tauri.conf.json",
      detail: "1320 × 860 · Overlay title bar",
    },
    {
      id: "k3",
      type: "tool",
      kind: "edit",
      title: "Update AppShell layout",
      status: "completed",
      path: "src/components/layout/AppShell.tsx",
      diff: [
        {
          header: "@@ src/components/layout/AppShell.tsx",
          lines: [
            { type: "ctx", text: "export function AppShell() {" },
            { type: "del", text: "  return <main>Hello</main>;" },
            { type: "add", text: "  return (" },
            { type: "add", text: "    <div className=\"flex h-full\">" },
            { type: "add", text: "      <Sidebar />" },
            { type: "add", text: "      <ChatPane />" },
            { type: "add", text: "    </div>" },
            { type: "add", text: "  );" },
          ],
        },
      ],
    },
    {
      id: "k4",
      type: "tool",
      kind: "execute",
      title: "pnpm tauri dev",
      status: "running",
      detail: "Waiting for the window to open…",
    },
    {
      id: "a1",
      type: "text",
      text: "第 1 阶段空壳已经搭好。左侧是按项目分组的会话，中间是带思考折叠、工具卡和 diff 预览的对话区，右侧是可开关的文件树。\n\n主题和中英文可以在右上角切换。现在还没有连接 `grok agent stdio`，发送按钮只会把草稿放进当前会话，方便你先看布局。",
    },
  ],
  "s-empty": [],
  "s-news": [
    {
      id: "n1",
      type: "user",
      text: "Generate today's markets daily from the Financial_News folder.",
    },
    {
      id: "n2",
      type: "text",
      text: "This is placeholder history. Real session replay lands in Phase 6, reading `~/.grok/sessions`.",
    },
  ],
};

export const mockFiles: FileNode[] = [
  {
    name: "src",
    path: "src",
    type: "dir",
    children: [
      {
        name: "app",
        path: "src/app",
        type: "dir",
        children: [
          { name: "App.tsx", path: "src/app/App.tsx", type: "file" },
          { name: "providers.tsx", path: "src/app/providers.tsx", type: "file" },
        ],
      },
      {
        name: "features",
        path: "src/features",
        type: "dir",
        children: [
          { name: "chat", path: "src/features/chat", type: "dir" },
          { name: "sessions", path: "src/features/sessions", type: "dir" },
        ],
      },
      { name: "styles", path: "src/styles", type: "dir" },
    ],
  },
  {
    name: "src-tauri",
    path: "src-tauri",
    type: "dir",
    children: [
      { name: "Cargo.toml", path: "src-tauri/Cargo.toml", type: "file" },
      { name: "tauri.conf.json", path: "src-tauri/tauri.conf.json", type: "file" },
    ],
  },
  { name: "package.json", path: "package.json", type: "file" },
  { name: "README.md", path: "README.md", type: "file" },
];

export const mockFileContents: Record<string, string> = {
  "src/app/App.tsx": `export function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  );
}`,
  "src-tauri/tauri.conf.json": `{
  "productName": "Grok Build",
  "identifier": "com.yusa.grokui"
}`,
  "package.json": `{
  "name": "grokui",
  "private": true
}`,
  "README.md": `# GrokUI\n\nDesktop client for local Grok Build.`,
};
