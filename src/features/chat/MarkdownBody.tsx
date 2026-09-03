import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@/lib/tauri";

export const MarkdownBody = memo(function MarkdownBody({ text }: { text: string }) {
  return (
    <article className="markdown-body text-[14.5px] leading-7 text-fg">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(event) => {
                if (!href) return;
                event.preventDefault();
                void openLink(href);
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </article>
  );
});

async function openLink(href: string) {
  if (isTauri()) {
    try {
      await openUrl(href);
      return;
    } catch {
      // Browser fallback below.
    }
  }
  window.open(href, "_blank", "noopener,noreferrer");
}
