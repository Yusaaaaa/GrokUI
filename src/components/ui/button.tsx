import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "ghost" | "subtle" | "solid" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

export function Button({
  className,
  variant = "ghost",
  active = false,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-tauri-drag-region="false"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] transition-colors disabled:opacity-40",
        variant === "icon" && "size-8 rounded-md text-muted hover:bg-hover hover:text-fg",
        variant === "ghost" && "px-2.5 py-1.5 text-muted hover:bg-hover hover:text-fg",
        variant === "subtle" &&
          "border border-border bg-elevated px-2.5 py-1.5 text-fg hover:bg-hover",
        variant === "solid" && "bg-accent px-3 py-1.5 font-medium text-accent-fg hover:opacity-90",
        active && "bg-active text-fg",
        className,
      )}
      {...props}
    />
  );
}
