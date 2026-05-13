import { useState } from "react";
import {
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNetworkStore } from "@/stores/networkStore";

export type ActionStatus = "pending" | "executing" | "success" | "failed" | "rejected";

export type AssetFlow = {
  direction: "out" | "in";
  amount: string;
  token: string;
  kind: "token" | "object";
  objectName?: string;
};

export type WalletHolding = {
  symbol: string;
  name: string;
  amount: string;
  valueUsd?: string;
  change24h?: number;
};

export type YieldPosition = {
  protocol: string;
  asset: string;
  supplied: string;
  apy?: string;
  valueUsd?: string;
};

export type WalletPayload =
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
      emptyHint?: string;
    };

export type ProtocolPool = {
  protocol: string;
  asset: string;
  apy?: string;
  tvlUsd?: string;
  utilization?: string;
};

export type ProtocolCoin = {
  symbol: string;
  name: string;
  network?: string;
  liquidityUsd?: string;
};

export type ProtocolPayload =
  | {
      view: "pools";
      title: string;
      source: string;
      pools: ProtocolPool[];
      emptyHint?: string;
    }
  | {
      view: "coins";
      title: string;
      source: string;
      coins: ProtocolCoin[];
      emptyHint?: string;
    };

export type ChatActionBubbleMessage = {
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
  errorMessage?: string;
};

const LIST_LIMIT = 5;

function parsePct(s: string) {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function parseUsd(s?: string) {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

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

type YieldSort = "apy-desc" | "apy-asc" | "value-desc" | "value-asc" | "protocol" | "asset";

function YieldList({ positions, emptyHint }: { positions: YieldPosition[]; emptyHint?: string }) {
  const [sort, setSort] = useState<YieldSort>("apy-desc");
  const [protocol, setProtocol] = useState<string>("all");
  const [asset, setAsset] = useState<string>("all");
  const [open, setOpen] = useState(false);

  if (positions.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-xs text-muted-foreground">
        {emptyHint ?? "No yield positions to show."}
      </p>
    );
  }

  const protocols = Array.from(new Set(positions.map((p) => p.protocol)));
  const assets = Array.from(new Set(positions.map((p) => p.asset)));

  const filtered = positions.filter(
    (p) =>
      (protocol === "all" || p.protocol === protocol) &&
      (asset === "all" || p.asset === asset),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "apy-desc":
        return parsePct(b.apy ?? "0") - parsePct(a.apy ?? "0");
      case "apy-asc":
        return parsePct(a.apy ?? "0") - parsePct(b.apy ?? "0");
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
              <YieldRow key={`${p.protocol}-${p.asset}-${i}`} p={p} />
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
                <YieldRow key={`${p.protocol}-${p.asset}-m-${i}`} p={p} />
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
        {p.apy != null && p.apy !== "" && (
          <p className="text-xs font-semibold text-emerald-500">{p.apy} APY</p>
        )}
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

export function WalletBubble({ payload }: { payload: WalletPayload }) {
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
              <p className="text-base font-bold">${payload.totalUsd}</p>
            </div>
          )}
        </div>

        {payload.view === "portfolio" ? (
          holdings.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No token balances for this account on this network.
            </p>
          ) : (
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
                subtitle={`${payload.network}${payload.totalUsd ? ` · $${payload.totalUsd}` : ""}`}
              >
                <ul className="divide-y divide-border/60">
                  {holdings.map((h) => (
                    <HoldingRow key={h.symbol} h={h} />
                  ))}
                </ul>
              </ListModal>
            </>
          )
        ) : (
          <YieldList positions={payload.positions} emptyHint={payload.emptyHint} />
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
      <p className="text-sm font-bold text-emerald-500">{p.apy ?? "—"}</p>
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
      {c.liquidityUsd ? (
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Liquidity
          </p>
          <p className="text-sm font-semibold">{c.liquidityUsd}</p>
        </div>
      ) : (
        <div className="text-right text-[10px] text-muted-foreground font-semibold uppercase">
          —
        </div>
      )}
    </li>
  );
}

export function ProtocolBubble({ payload }: { payload: ProtocolPayload }) {
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

        {total === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            {payload.emptyHint ?? "No data to display."}
          </p>
        ) : payload.view === "pools" ? (
          <ul className="divide-y divide-border/60">
            {payload.pools.slice(0, LIST_LIMIT).map((p, i) => (
              <PoolRow key={`${p.protocol}-${p.asset}-${i}`} p={p} />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-border/60">
            {payload.coins.slice(0, LIST_LIMIT).map((c) => (
              <CoinRow key={`${c.symbol}-${c.name}`} c={c} />
            ))}
          </ul>
        )}

        {total > 0 && (
          <>
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
                    <PoolRow key={`${p.protocol}-${p.asset}-f-${i}`} p={p} />
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-border/60">
                  {payload.coins.map((c) => (
                    <CoinRow key={`${c.symbol}-f`} c={c} />
                  ))}
                </ul>
              )}
            </ListModal>
          </>
        )}
      </div>
    </div>
  );
}

export function ActionBubble({
  msg,
  onApprove,
  onReject,
}: {
  msg: ChatActionBubbleMessage;
  onApprove: () => void;
  onReject: () => void;
}) {
  const network = useNetworkStore((s) => s.network);
  const isExecuting = msg.status === "executing";
  const isDone = msg.status === "success";
  const isRejected = msg.status === "rejected";
  const isFailed = msg.status === "failed";

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
          {isRejected && (
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Dismissed</span>
          )}
          {isFailed && (
            <span className="text-[10px] font-bold uppercase text-rose-500">Failed</span>
          )}
        </div>

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

        {isFailed && msg.errorMessage && (
          <p className="mt-2 text-xs text-rose-500 font-medium">{msg.errorMessage}</p>
        )}

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

        <div className="mt-3 flex items-center gap-2 flex-wrap">
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
                        i % 2 === 1 ? <strong key={i}>{c}</strong> : <span key={i}>{c}</span>,
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
                    onClick={() => {
                      const d = msg.digest;
                      if (d) void navigator.clipboard.writeText(d);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm font-bold text-brand hover:bg-brand/10 transition"
                  >
                    <Copy className="w-4 h-4" />
                    Copy digest · {msg.digest.slice(0, 8)}…{msg.digest.slice(-6)}
                  </button>
                  {network && (
                    <a
                      href={`${network.explorerBaseUrl}/tx/${encodeURIComponent(msg.digest)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm font-bold text-brand hover:bg-brand/10 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on explorer
                    </a>
                  )}
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
            <span className="ml-auto text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
              {msg.digest.slice(0, 6)}…{msg.digest.slice(-4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TransactionResultBubble({
  digest,
  title,
  summary,
  explorerUrl,
}: {
  digest: string;
  title: string;
  summary: string;
  explorerUrl?: string | null;
}) {
  const network = useNetworkStore((s) => s.network);
  const href = explorerUrl ?? (network ? `${network.explorerBaseUrl}/tx/${encodeURIComponent(digest)}` : null);
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-card/60 p-4 space-y-2">
        <p className="text-[10px] font-bold tracking-[0.18em] text-emerald-500 uppercase">{title}</p>
        <p className="text-sm text-muted-foreground">{summary}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(digest)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy digest
          </button>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold text-brand"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Explorer
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function StructuredErrorBubble({ message }: { message: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-3xl rounded-bl-lg border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
        {message}
      </div>
    </div>
  );
}
