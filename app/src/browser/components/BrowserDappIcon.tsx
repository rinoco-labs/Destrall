import { useState } from "react";

const FALLBACK_COLORS = [
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

function colorClassForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % FALLBACK_COLORS.length;
  }
  return FALLBACK_COLORS[hash] ?? FALLBACK_COLORS[0];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export type BrowserDappIconProps = {
  name: string;
  iconUrl?: string;
  size?: "sm" | "md";
};

export function BrowserDappIcon({ name, iconUrl, size = "md" }: BrowserDappIconProps) {
  const [failed, setFailed] = useState(false);
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const fallbackClass = `${dim} ${colorClassForName(name)} flex shrink-0 items-center justify-center rounded-xl border border-border/50 font-semibold`;

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={`${dim} shrink-0 rounded-xl border border-border/60 bg-secondary/40 object-cover`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={fallbackClass} aria-hidden>
      {initials(name)}
    </div>
  );
}
