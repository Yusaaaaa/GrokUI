# GrokUI

Desktop client for the official local Grok Build CLI. It speaks ACP (`grok agent stdio`) and does not reimplement the agent.

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- Rust (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)

## Current status

The window talks to the official local CLI over ACP (`grok agent stdio`). It does not reimplement the agent.

On first launch it checks that `grok` is installed and that you are signed in, then starts a session in the last project folder.

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cd /Users/yusa/GrokWorkSpace/GrokUI
pnpm install
pnpm tauri dev
```

Frontend-only preview:

```bash
pnpm dev
```

Then open `http://localhost:1420`.

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Yusaaaaa">
        <img src="https://github.com/Yusaaaaa.png?size=120" width="100" alt="Haowei Fan" /><br />
        <sub><b>Haowei Fan</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://x.ai">
        <img src="https://github.com/xai-org.png?size=120" width="100" alt="Grok" /><br />
        <sub><b>Grok</b></sub>
      </a>
    </td>
  </tr>
</table>
