import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Paperclip,
  Send,
  ImageIcon,
  ArrowDownCircle,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Copy,
  ExternalLink,
  Info,
  Package,
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  Box,
  Wallet,
  TrendingUp,
  Coins,
  PieChart,
  Sprout,
  Network,
  ArrowLeftRight,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
  X,
  FileText,
  UploadCloud,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useWalletStore } from "@/stores/walletStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAiModelStore } from "@/stores/aiModelStore";
import { isDestrallDesktop } from "@/lib/desktopWallet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  head: () => ({
    meta: [
      { title: "Assistant — Destrall" },
      { name: "description", content: "Chat with your local AI assistant." },
    ],
  }),
});

type ActionStatus = "pending" | "executing" | "success";

type AssetFlow = {
  direction: "out" | "in";
  amount: string;
  token: string;
  kind: "token" | "object";
  objectName?: string;
};

type WalletHolding = {
  symbol: string;
  name: string;
  amount: string;
  valueUsd?: string;
  change24h?: number;
};

type YieldPosition = {
  protocol: string;
  asset: string;
  supplied: string;
  apy: string;
  valueUsd?: string;
};

type WalletPayload =
  | {
      view: "portfolio";
      title: string;
      network: string;
      totalUsd?: string;
      totalNative?: string;
      holdings: WalletHolding[];
    }
  | {
      view: "yield";
      title: string;
      network: string;
      totalUsd?: string;
      positions: YieldPosition[];
    };

type ProtocolPool = {
  protocol: string;
  asset: string;
  apy: string;
  tvlUsd?: string;
  utilization?: string;
};

type ProtocolCoin = {
  symbol: string;
  name: string;
  network?: string;
  liquidityUsd?: string;
};

type ProtocolPayload =
  | {
      view: "pools";
      title: string;
      source: string;
      pools: ProtocolPool[];
    }
  | {
      view: "coins";
      title: string;
      source: string;
      coins: ProtocolCoin[];
    };

type Msg =
  | { id: string; kind: "user"; text: string; attachments?: Attachment[] }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "wallet"; payload: WalletPayload }
  | { id: string; kind: "protocol"; payload: ProtocolPayload }
  | {
      id: string;
      kind: "action";
      status: ActionStatus;
      title: string;
      label: string;
      source: { type: "core" | "package"; name: string };
      flows: AssetFlow[];
      details: { k: string; v: string }[];
      note: string;
      digest?: string;
    };

type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage: boolean;
};

const initialMessages: Msg[] = [];

function UserBubble({ text, attachments }: { text: string; attachments?: Attachment[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-brand text-brand-foreground px-5 py-3 text-sm font-medium shadow-sm space-y-2">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) =>
              a.isImage ? (
                <img
                  key={a.id}
                  src={a.url}
                  alt={a.name}
                  className="max-h-40 rounded-xl border border-white/20 object-cover"
                />
              ) : (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-[160px]">{a.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {text && <div>{text}</div>}
      </div>
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-3xl rounded-bl-lg border border-border bg-card/60 px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap">
        {text.split("**").map((chunk, i) =>
          i % 2 === 1 ? (
            <strong key={i} className="font-semibold">
              {chunk}
            </strong>
          ) : (
            <span key={i}>{chunk}</span>
          )
        )}
      </div>
    </div>
  );
}

type YieldSort = "apy-desc" | "apy-asc" | "value-desc" | "value-asc" | "protocol" | "asset";

function parsePct(s: string) {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function parseUsd(s?: string) {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

const LIST_LIMIT = 5;

function MoreFooter({
  total,
  shown,
  onOpen,
}: {
  total: number;
  shown: number;
  onOpen: () => void;
}) {
  if (total <= shown) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full px-4 py-2.5 border-t border-border/60 text-xs font-semibold text-brand hover:bg-brand/5 transition-colors flex items-center justify-center gap-1.5"
    >
      View all {total} <ArrowDownCircle className="w-3.5 h-3.5" />
    </button>
  );
}

function ListModal({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/60">
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function YieldList({ positions }: { positions: YieldPosition[] }) {
  const [sort, setSort] = useState<YieldSort>("apy-desc");
  const [protocol, setProtocol] = useState<string>("all");
  const [asset, setAsset] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const protocols = Array.from(new Set(positions.map((p) => p.protocol)));
  const assets = Array.from(new Set(positions.map((p) => p.asset)));

  const filtered = positions.filter(
    (p) =>
      (protocol === "all" || p.protocol === protocol) &&
      (asset === "all" || p.asset === asset)
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "apy-desc":
        return parsePct(b.apy) - parsePct(a.apy);
      case "apy-asc":
        return parsePct(a.apy) - parsePct(b.apy);
      case "value-desc":
        return parseUsd(b.valueUsd) - parseUsd(a.valueUsd);
      case "value-asc":
        return parseUsd(a.valueUsd) - parseUsd(b.valueUsd);
      case "protocol":
        return a.protocol.localeCompare(b.protocol);
      case "asset":
        return a.asset.localeCompare(b.asset);
    }
  });

  const selectCls =
    "h-7 rounded-full border border-border bg-background/60 px-2 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-brand/60";

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap px-4 py-2.5 border-b border-border/60 bg-background/30">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
          Sort
        </span>
        <select
          aria-label="Sort yield positions"
          className={selectCls}
          value={sort}
          onChange={(e) => setSort(e.target.value as YieldSort)}
        >
          <option value="apy-desc">APY ↓</option>
          <option value="apy-asc">APY ↑</option>
          <option value="value-desc">Value ↓</option>
          <option value="value-asc">Value ↑</option>
          <option value="protocol">Protocol</option>
          <option value="asset">Asset</option>
        </select>
        <select
          aria-label="Filter by protocol"
          className={selectCls}
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
        >
          <option value="all">All protocols</option>
          {protocols.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by asset"
          className={selectCls}
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
        >
          <option value="all">All assets</option>
          {assets.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          No positions match these filters.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {sorted.slice(0, LIST_LIMIT).map((p, i) => (
              <YieldRow key={i} p={p} />
            ))}
          </ul>
          <MoreFooter
            total={sorted.length}
            shown={LIST_LIMIT}
            onOpen={() => setOpen(true)}
          />
          <ListModal
            open={open}
            onOpenChange={setOpen}
            title="Yield positions"
            subtitle={`${sorted.length} positions`}
          >
            <ul className="divide-y divide-border/60">
              {sorted.map((p, i) => (
                <YieldRow key={i} p={p} />
              ))}
            </ul>
          </ListModal>
        </>
      )}
    </div>
  );
}

function YieldRow({ p }: { p: YieldPosition }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
        <Coins className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {p.protocol} · {p.asset}
        </p>
        <p className="text-xs text-muted-foreground">{p.supplied}</p>
      </div>
      <div className="text-right">
        {p.valueUsd && <p className="text-sm font-semibold">{p.valueUsd}</p>}
        <p className="text-xs font-semibold text-emerald-500">{p.apy} APY</p>
      </div>
    </li>
  );
}

function HoldingRow({ h }: { h: WalletHolding }) {
  const up = (h.change24h ?? 0) > 0;
  const down = (h.change24h ?? 0) < 0;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-[10px] font-bold">
        {h.symbol.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{h.name}</p>
        <p className="text-xs text-muted-foreground">
          {h.amount} {h.symbol}
        </p>
      </div>
      <div className="text-right">
        {h.valueUsd && <p className="text-sm font-semibold">{h.valueUsd}</p>}
        {h.change24h !== undefined && h.change24h !== 0 && (
          <p
            className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
              up ? "text-emerald-500" : down ? "text-rose-500" : "text-muted-foreground"
            }`}
          >
            <TrendingUp className={`w-3 h-3 ${down ? "rotate-180" : ""}`} />
            {up ? "+" : ""}
            {h.change24h}%
          </p>
        )}
      </div>
    </li>
  );
}

function WalletBubble({ payload }: { payload: WalletPayload }) {
  const Icon = payload.view === "portfolio" ? PieChart : Sprout;
  const [open, setOpen] = useState(false);
  const holdings = payload.view === "portfolio" ? payload.holdings : [];
  return (
    <div className="flex justify-start">
      <div
        className="w-full max-w-md rounded-2xl border border-brand/40 bg-card/60 overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklab, var(--brand) 8%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl border border-brand/40 bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-brand uppercase">
              {payload.title}
            </p>
            <p className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">{payload.network}</span>
            </p>
          </div>
          {payload.totalUsd && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Total
              </p>
              <p className="text-base font-bold">{payload.totalUsd}</p>
            </div>
          )}
        </div>

        {payload.view === "portfolio" ? (
          <>
            <ul className="divide-y divide-border/60">
              {holdings.slice(0, LIST_LIMIT).map((h) => (
                <HoldingRow key={h.symbol} h={h} />
              ))}
            </ul>
            <MoreFooter
              total={holdings.length}
              shown={LIST_LIMIT}
              onOpen={() => setOpen(true)}
            />
            <ListModal
              open={open}
              onOpenChange={setOpen}
              title={payload.title}
              subtitle={`${payload.network}${payload.totalUsd ? ` · ${payload.totalUsd}` : ""}`}
            >
              <ul className="divide-y divide-border/60">
                {holdings.map((h) => (
                  <HoldingRow key={h.symbol} h={h} />
                ))}
              </ul>
            </ListModal>
          </>
        ) : (
          <YieldList positions={payload.positions} />
        )}
      </div>
    </div>
  );
}

function PoolRow({ p }: { p: ProtocolPool }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center text-[10px] font-bold">
        {p.asset.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {p.protocol} · {p.asset}
        </p>
        {(p.tvlUsd || p.utilization) && (
          <p className="text-xs text-muted-foreground">
            {p.tvlUsd && <>TVL {p.tvlUsd}</>}
            {p.tvlUsd && p.utilization && " · "}
            {p.utilization && <>Util {p.utilization}</>}
          </p>
        )}
      </div>
      <p className="text-sm font-bold text-emerald-500">{p.apy}</p>
    </li>
  );
}

function CoinRow({ c }: { c: ProtocolCoin }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center text-[10px] font-bold">
        {c.symbol.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{c.name}</p>
        <p className="text-xs text-muted-foreground">
          {c.symbol}
          {c.network && <> · {c.network}</>}
        </p>
      </div>
      {c.liquidityUsd && (
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Liquidity
          </p>
          <p className="text-sm font-semibold">{c.liquidityUsd}</p>
        </div>
      )}
    </li>
  );
}

function ProtocolBubble({ payload }: { payload: ProtocolPayload }) {
  const Icon = payload.view === "pools" ? Network : ArrowLeftRight;
  const [open, setOpen] = useState(false);
  const total = payload.view === "pools" ? payload.pools.length : payload.coins.length;
  return (
    <div className="flex justify-start">
      <div
        className="w-full max-w-md rounded-2xl border border-sky-500/40 bg-card/60 overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklab, oklch(0.7 0.15 230) 8%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-sky-500 uppercase">
              Protocol info
            </p>
            <p className="text-sm font-semibold truncate">{payload.title}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-500">
            <Info className="w-3 h-3" />
            {payload.source}
          </span>
        </div>

        {payload.view === "pools" ? (
          <ul className="divide-y divide-border/60">
            {payload.pools.slice(0, LIST_LIMIT).map((p, i) => (
              <PoolRow key={i} p={p} />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border/60">
            {payload.coins.slice(0, LIST_LIMIT).map((c) => (
              <CoinRow key={c.symbol} c={c} />
            ))}
          </ul>
        )}

        <MoreFooter total={total} shown={LIST_LIMIT} onOpen={() => setOpen(true)} />
        <ListModal
          open={open}
          onOpenChange={setOpen}
          title={payload.title}
          subtitle={`${payload.source} · ${total} ${payload.view === "pools" ? "pools" : "coins"}`}
        >
          {payload.view === "pools" ? (
            <ul className="divide-y divide-border/60">
              {payload.pools.map((p, i) => (
                <PoolRow key={i} p={p} />
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border/60">
              {payload.coins.map((c) => (
                <CoinRow key={c.symbol} c={c} />
              ))}
            </ul>
          )}
        </ListModal>
      </div>
    </div>
  );
}

function ActionBubble({
  msg,
  onApprove,
  onReject,
}: {
  msg: Extract<Msg, { kind: "action" }>;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isExecuting = msg.status === "executing";
  const isDone = msg.status === "success";

  const summary =
    msg.details.find((d) => d.k === "Amount")?.v ??
    msg.details.find((d) => d.k === "Token")?.v ??
    msg.label;

  return (
    <div className="flex justify-start">
      <div
        className="w-full max-w-md rounded-2xl border border-brand/40 bg-card/60 p-4"
        style={{
          background:
            "linear-gradient(160deg, color-mix(in oklab, var(--brand) 8%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl border border-brand/40 bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <ArrowDownCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-[0.18em] text-brand uppercase">
              {msg.title}
            </p>
            <p className="text-sm font-semibold truncate">{summary}</p>
          </div>
          {isExecuting && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/40 px-2 py-1 text-[10px] font-bold tracking-widest text-brand uppercase">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          )}
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-500 uppercase">
              <CheckCircle2 className="w-3 h-3" />
              Done
            </span>
          )}
        </div>

        {/* Source + flow summary */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              msg.source.type === "core"
                ? "border-brand/40 bg-brand/10 text-brand"
                : "border-amber-500/40 bg-amber-500/10 text-amber-500"
            }`}
            title={msg.source.type === "core" ? "Built-in core action" : "Installed package"}
          >
            {msg.source.type === "core" ? (
              <Shield className="w-3 h-3" />
            ) : (
              <Package className="w-3 h-3" />
            )}
            {msg.source.type === "core" ? "Core" : msg.source.name}
          </span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {msg.flows.map((f, i) => {
            const isOut = f.direction === "out";
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs"
              >
                <span
                  className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${
                    isOut
                      ? "bg-rose-500/10 text-rose-500"
                      : "bg-emerald-500/10 text-emerald-500"
                  }`}
                >
                  {isOut ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="font-semibold">
                  {isOut ? "Out" : "In"} · {f.amount} {f.token}
                </span>
                {f.kind === "object" && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                    <Box className="w-3 h-3" />
                    {f.objectName ?? "Object"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition"
              >
                <Info className="w-3.5 h-3.5" />
                Details
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{msg.label}</DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-[0.18em] text-brand">
                  {msg.title}
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border border-border/60 bg-background/40 p-3 text-xs">
                <p className="text-muted-foreground mb-2 font-semibold uppercase tracking-wider text-[10px]">
                  Source
                </p>
                <div className="flex items-center gap-2">
                  {msg.source.type === "core" ? (
                    <Shield className="w-4 h-4 text-brand" />
                  ) : (
                    <Package className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="font-semibold">{msg.source.name}</span>
                  <span className="text-muted-foreground">
                    · {msg.source.type === "core" ? "Built-in core" : "Installed package"}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/40 p-3 text-xs space-y-2">
                <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                  Asset movement
                </p>
                {msg.flows.map((f, i) => {
                  const isOut = f.direction === "out";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className={`inline-flex w-6 h-6 items-center justify-center rounded-full ${
                          isOut
                            ? "bg-rose-500/10 text-rose-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        }`}
                      >
                        {isOut ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span className="font-semibold">
                        {isOut ? "Leaves wallet" : "Enters wallet"} · {f.amount} {f.token}
                      </span>
                      <span className="ml-auto text-muted-foreground inline-flex items-center gap-1">
                        <Box className="w-3 h-3" />
                        {f.kind === "object" ? f.objectName ?? "Object" : "Token"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <dl className="divide-y divide-border/60 text-sm">
                {msg.details.map((d) => (
                  <div key={d.k} className="flex items-center justify-between py-2.5 gap-4">
                    <dt className="text-muted-foreground">{d.k}</dt>
                    <dd className="font-semibold text-right">
                      {d.v.split("**").map((c, i) =>
                        i % 2 === 1 ? <strong key={i}>{c}</strong> : <span key={i}>{c}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-start gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3 text-xs text-muted-foreground">
                <ShieldAlert className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p>{msg.note}</p>
              </div>
              {isDone && msg.digest && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm font-bold text-brand hover:bg-brand/10 transition"
                  >
                    <Copy className="w-4 h-4" />
                    Copy digest · {msg.digest.slice(0, 8)}…{msg.digest.slice(-6)}
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm font-bold text-brand hover:bg-brand/10 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Suiscan
                  </button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {msg.status === "pending" && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onReject}
                className="px-3 py-1.5 text-xs font-bold text-brand hover:opacity-80 transition"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={onApprove}
                className="px-4 py-1.5 rounded-full bg-brand text-brand-foreground text-xs font-bold hover:opacity-95 transition"
              >
                Approve
              </button>
            </div>
          )}

          {isExecuting && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Executing…
            </span>
          )}

          {isDone && msg.digest && (
            <span className="ml-auto text-[11px] font-mono text-muted-foreground truncate">
              {msg.digest.slice(0, 6)}…{msg.digest.slice(-4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

type ChatHistoryItem = { id: string; title: string; pinned: boolean };

const initialHistory: ChatHistoryItem[] = [];

function HistoryItem({
  item,
  active,
  onPin,
  onDelete,
}: {
  item: ChatHistoryItem;
  active: boolean;
  onPin: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        className={`w-full text-left pl-3 pr-9 py-2 rounded-lg text-sm font-medium truncate transition ${
          active ? "bg-secondary/60" : "hover:bg-secondary/40"
        }`}
      >
        {item.pinned && <Pin className="inline-block w-3 h-3 mr-1.5 -mt-0.5 text-brand" />}
        {item.title}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Chat options"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl">
          <DropdownMenuItem onSelect={onPin} className="gap-2 text-xs font-medium cursor-pointer">
            {item.pinned ? (
              <>
                <PinOff className="w-3.5 h-3.5" />
                Unpin chat
              </>
            ) : (
              <>
                <Pin className="w-3.5 h-3.5" />
                Pin chat
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onDelete}
            className="gap-2 text-xs font-medium text-rose-500 focus:text-rose-500 focus:bg-rose-500/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AssistantPage() {
  const [historyOpen, setHistoryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [history, setHistory] = useState<ChatHistoryItem[]>(initialHistory);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const activeAccountId = useWalletStore((s) => s.activeAccountId);
  const language = useSettingsStore((s) => s.language);
  const aiPersonality = useSettingsStore((s) => s.aiPersonality);
  const isModelLoaded = useAiModelStore((s) => s.isModelLoaded);
  const runtimeError = useAiModelStore((s) => s.runtimeError);
  const selectedMeta = useAiModelStore((s) =>
    s.availableModels.find((m) => m.id === (s.activeModelId ?? s.selectedModelId)),
  );
  const initializeModelState = useAiModelStore((s) => s.initializeModelState);
  const sendMessage = useAiModelStore((s) => s.sendMessage);
  const refreshAi = useAiModelStore((s) => s.refreshFromMain);
  const [llmBusy, setLlmBusy] = useState(false);

  useEffect(() => {
    void initializeModelState();
  }, [initializeModelState]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [message]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const updateAction = (id: string, patch: Partial<Extract<Msg, { kind: "action" }>>) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.kind === "action" ? { ...m, ...patch } : m))
    );

  const handleApprove = (id: string) => {
    updateAction(id, { status: "executing" });
    setTimeout(() => {
      updateAction(id, {
        status: "success",
        digest: "53nJhwJgX9pQrTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwRntGak",
      });
    }, 2200);
  };

  const handleReject = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const addFiles = (files: FileList | File[]) => {
    const next: Attachment[] = [];
    Array.from(files).forEach((f) => {
      const isImage = f.type.startsWith("image/");
      next.push({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        url: URL.createObjectURL(f),
        isImage,
      });
    });
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text && attachments.length === 0) return;

    if (attachments.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: "user",
          text,
          attachments: attachments.length ? attachments : undefined,
        },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "File attachments are not sent to the local model yet. Paste text or try again without attachments.",
        },
      ]);
      setMessage("");
      setAttachments([]);
      return;
    }

    if (!isDestrallDesktop()) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "Open the Destrall desktop app to chat with the on-device model.",
        },
      ]);
      setMessage("");
      return;
    }

    if (!activeAccountId) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "No active wallet account. Unlock your wallet or add an account, then try again.",
        },
      ]);
      setMessage("");
      return;
    }

    if (!isModelLoaded) {
      void refreshAi();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "user", text },
        {
          id: crypto.randomUUID(),
          kind: "assistant",
          text: "No local model is loaded. Use **Settings → AI Model** to download and load a model, then come back here.",
        },
      ]);
      setMessage("");
      return;
    }

    const prior = messages
      .filter((m): m is Extract<Msg, { kind: "user" }> | Extract<Msg, { kind: "assistant" }> => {
        return m.kind === "user" || m.kind === "assistant";
      })
      .map((m) =>
        m.kind === "user"
          ? ({ role: "user" as const, content: m.text })
          : ({ role: "assistant" as const, content: m.text }),
      );

    const conversation = [...prior, { role: "user" as const, content: text }];
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), kind: "user", text }]);
    setMessage("");
    setLlmBusy(true);
    try {
      const reply = await sendMessage({
        messages: conversation,
        accountId: activeAccountId,
        language,
        personalityId: aiPersonality,
      });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "assistant", text: reply },
      ]);
    } catch (e) {
      const err = e instanceof Error ? e.message : "The model failed to respond.";
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "assistant", text: `**Error**\n${err}` },
      ]);
    } finally {
      setLlmBusy(false);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const filteredHistory = history.filter((h) =>
    h.title.toLowerCase().includes(search.toLowerCase())
  );
  const sortedHistory = [...filteredHistory].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );

  const togglePin = (id: string) =>
    setHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h))
    );
  const deleteChat = (id: string) =>
    setHistory((prev) => prev.filter((h) => h.id !== id));

  return (
    <AppShell active="assistant">
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Assistant</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="New chat"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-label={historyOpen ? "Hide chat history" : "Show chat history"}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-secondary/40 text-foreground hover:bg-secondary transition"
              >
                {historyOpen ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex flex-col min-h-0"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
              {isDestrallDesktop() && runtimeError ? (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {runtimeError}
                </div>
              ) : null}
              {isDestrallDesktop() && !isModelLoaded ? (
                <div className="rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                  <span>Local model is not loaded.</span>
                  <Link to="/settings" className="font-semibold text-brand hover:underline">
                    Open Settings
                  </Link>
                </div>
              ) : null}
              {messages.map((m) => {
                if (m.kind === "user")
                  return (
                    <UserBubble
                      key={m.id}
                      text={m.text}
                      attachments={m.attachments}
                    />
                  );
                if (m.kind === "assistant")
                  return <AssistantBubble key={m.id} text={m.text} />;
                if (m.kind === "wallet")
                  return <WalletBubble key={m.id} payload={m.payload} />;
                if (m.kind === "protocol")
                  return <ProtocolBubble key={m.id} payload={m.payload} />;
                return (
                  <ActionBubble
                    key={m.id}
                    msg={m}
                    onApprove={() => handleApprove(m.id)}
                    onReject={() => handleReject(m.id)}
                  />
                );
              })}
              {llmBusy ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-3xl rounded-bl-lg border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating…
                  </div>
                </div>
              ) : null}
            </div>

            {dragActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand bg-brand/10 backdrop-blur-sm pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-brand">
                  <UploadCloud className="w-10 h-10" />
                  <p className="text-sm font-bold uppercase tracking-wider">
                    Drop files to attach
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Images and documents supported
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 rounded-2xl border border-border bg-card/40 p-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="relative group inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 pr-7 pl-1 py-1"
                  >
                    {a.isImage ? (
                      <img
                        src={a.url}
                        alt={a.name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-xs leading-tight max-w-[140px]">
                      <p className="font-semibold truncate">{a.name}</p>
                      <p className="text-muted-foreground">{formatBytes(a.size)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => removeAttachment(a.id)}
                      className="absolute right-1 top-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-foreground hover:bg-rose-500/20 hover:text-rose-500 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-3xl border border-border bg-card/40 px-4 py-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                aria-label="Attach image"
                onClick={() => imageInputRef.current?.click()}
                className="text-muted-foreground hover:text-foreground transition shrink-0 mb-2"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.length) {
                    e.preventDefault();
                    addFiles(files);
                  }
                }}
                rows={1}
                placeholder="Ask about portfolio, swaps, risks..."
                className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground py-2 max-h-[200px] overflow-y-auto leading-relaxed"
              />
              <button
                type="button"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
                className="text-muted-foreground hover:text-foreground transition shrink-0 mb-2"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={llmBusy}
                aria-label="Send message"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition shrink-0 mb-1"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {selectedMeta
                ? `${selectedMeta.name}${isModelLoaded ? " · loaded" : " · not loaded"}`
                : "No model selected"}
            </p>
          </div>
        </div>

        {/* Chat history panel */}
        {historyOpen && (
          <>
            <div className="w-px self-stretch bg-border/60" aria-hidden="true" />
            <aside className="w-72 shrink-0 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Chat History</h2>
                <button
                  type="button"
                  aria-label="New chat"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand text-brand-foreground hover:opacity-90 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full rounded-full border border-border bg-card/40 pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-brand transition"
                />
              </div>
              <div className="flex-1 min-h-0 space-y-1 overflow-y-auto overflow-x-visible pr-1 pb-6">
                {sortedHistory.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No chats found.
                  </p>
                ) : (
                  sortedHistory.map((h) => (
                    <HistoryItem
                      key={h.id}
                      item={h}
                      active={h.id === activeChatId}
                      onPin={() => togglePin(h.id)}
                      onDelete={() => {
                        deleteChat(h.id);
                        if (activeChatId === h.id) setActiveChatId("");
                      }}
                    />
                  ))
                )}
              </div>
            </aside>
          </>
        )}
      </div>
    </AppShell>
  );
}
