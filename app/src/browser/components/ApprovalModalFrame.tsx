import type { ReactNode } from "react";

export type ApprovalModalFrameProps = {
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

/**
 * Three-zone modal: fixed header, scrollable body, pinned footer.
 * Body uses h-0 + flex-1 so it cannot grow with content (requires parent with explicit height).
 */
export function ApprovalModalFrame({ header, children, footer, className }: ApprovalModalFrameProps) {
  return (
    <div
      className={[
        "flex h-full min-h-0 w-full flex-col overflow-hidden",
        "rounded-xl border border-border bg-background shadow-xl",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="z-10 shrink-0 border-b border-border bg-background px-5 py-4">{header}</header>

      <div
        className="h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y px-5 py-4 [-webkit-overflow-scrolling:touch]"
        role="region"
        aria-label="Transaction details"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="space-y-4 pb-2">{children}</div>
      </div>

      <footer
        className={[
          "z-10 shrink-0 border-t border-border bg-background px-5 pt-4",
          "pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
          "shadow-[0_-8px_24px_rgba(0,0,0,0.35)]",
        ].join(" ")}
      >
        {footer}
      </footer>
    </div>
  );
}
