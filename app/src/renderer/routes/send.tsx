import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, Send as SendIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { shortAddr } from "@/lib/wallet-store";
import { useWalletStore, getActiveWalletAccount } from "@/stores/walletStore";
import { useNetworkStore } from "@/stores/networkStore";
import { desktopGetChainBalances, desktopPrepareTransfer, desktopConfirmTransfer } from "@/lib/desktopChain";
import { desktopListContacts } from "@/lib/desktopContacts";
import type { ContactRow } from "../../shared/ipc";
import { chainQueryScope } from "@/components/network-wallet-query-sync";
import { SUI_COIN_TYPE } from "../../config/chains/sui";

type SendSearch = { to?: string; name?: string; token?: string; amount?: string };

export const Route = createFileRoute("/send")({
  validateSearch: (s: Record<string, unknown>): SendSearch => ({
    to: typeof s.to === "string" ? s.to : undefined,
    name: typeof s.name === "string" ? s.name : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
    amount: typeof s.amount === "string" ? s.amount : undefined,
  }),
  component: SendPage,
  head: () => ({
    meta: [
      { title: "Send — Destrall" },
      { name: "description", content: "Send tokens to any wallet address." },
    ],
  }),
});

function SendPage() {
  const search = useSearch({ from: "/send" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const walletSnap = useWalletStore();
  const activeAccount = useMemo(() => getActiveWalletAccount(walletSnap), [walletSnap]);
  const network = useNetworkStore((s) => s.network);

  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [selectedCoinType, setSelectedCoinType] = useState<string>(SUI_COIN_TYPE);
  const [amount, setAmount] = useState(search.amount || "");
  const [address, setAddress] = useState(search.to || "");
  const [recipientName, setRecipientName] = useState(search.name || "");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [doneDigest, setDoneDigest] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prepareSummary, setPrepareSummary] = useState<{
    gasBudgetFormatted: string;
    amountFormatted: string;
    symbol: string;
  } | null>(null);

  useEffect(() => {
    void desktopListContacts().then(setContacts);
  }, []);

  const balancesQuery = useQuery({
    queryKey: [
      ...chainQueryScope,
      "balances",
      activeAccount?.id ?? "",
      network?.activeEnvironment ?? "",
    ],
    queryFn: async () => {
      if (!activeAccount) return [];
      return desktopGetChainBalances(activeAccount.id);
    },
    enabled: Boolean(activeAccount?.id && network),
  });

  const tokens = balancesQuery.data ?? [];
  const selected = tokens.find((t) => t.coinType === selectedCoinType) ?? tokens[0];

  useEffect(() => {
    if (search.token) {
      const match = tokens.find((t) => t.coinType === search.token);
      if (match) {
        setSelectedCoinType(match.coinType);
      }
    } else if (tokens.length && !tokens.some((t) => t.coinType === selectedCoinType)) {
      setSelectedCoinType(tokens[0].coinType);
    }
  }, [search.token, tokens, selectedCoinType]);

  const amountTrim = amount.trim();
  const valid =
    amountTrim.length > 0 &&
    address.trim().length > 0 &&
    Boolean(activeAccount) &&
    Boolean(selected) &&
    /^\d+(\.\d+)?$/.test(amountTrim);

  const goPrepare = async () => {
    setSendError(null);
    if (!activeAccount || !selected) return;
    setSubmitting(true);
    try {
      const prep = await desktopPrepareTransfer({
        accountId: activeAccount.id,
        recipient: address.trim(),
        coinType: selected.coinType,
        amountDisplay: amountTrim,
      });
      setPendingRequestId(prep.transferRequestId);
      setPrepareSummary({
        gasBudgetFormatted: prep.summary.gasBudgetFormatted,
        amountFormatted: prep.summary.amountFormatted,
        symbol: prep.summary.symbol,
      });
      setStep("review");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Could not prepare transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const goConfirm = async () => {
    if (!pendingRequestId) return;
    setSendError(null);
    setSubmitting(true);
    try {
      const res = await desktopConfirmTransfer(pendingRequestId);
      setDoneDigest(res.digest);
      await queryClient.invalidateQueries({ queryKey: chainQueryScope });
      setStep("done");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const tokenLabel = selected ? `${selected.symbol}` : "—";

  return (
    <AppShell active="home">
      <div className="max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/home"
            className="w-9 h-9 rounded-full border border-border bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Send</h1>
        </div>

        {sendError && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {sendError}
          </div>
        )}

        {step === "form" && (
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-6 space-y-6">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Token</label>
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setTokenOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-background/60 px-4 py-3 hover:border-brand/60 transition"
                >
                  <span className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">
                      {(selected?.symbol ?? "?").charAt(0)}
                    </span>
                    <span className="font-semibold">{selected?.symbol ?? "—"}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                      {selected?.coinType}
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>
                {tokenOpen && tokens.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {tokens.map((t) => (
                      <button
                        key={t.coinType}
                        type="button"
                        onClick={() => {
                          setSelectedCoinType(t.coinType);
                          setTokenOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/60 transition text-left"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                            {t.symbol.charAt(0)}
                          </span>
                          <span className="font-medium truncate">{t.symbol}</span>
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2 text-right">
                          <span className="block">{t.balanceFormatted}</span>
                          {t.usdValue ? (
                            <span className="block text-[10px] tabular-nums text-muted-foreground/90">
                              ≈ {t.usdValue}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount</label>
              <div className="mt-2 flex items-center rounded-xl border border-border bg-background/60 px-4 py-3 focus-within:border-brand/60 transition">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-2xl font-bold focus:outline-none"
                />
                <span className="text-sm font-semibold text-muted-foreground">{tokenLabel}</span>
              </div>
              {selected && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Available: {selected.balanceFormatted} {selected.symbol}
                  {selected.usdValue ? (
                    <span className="tabular-nums"> · ≈ {selected.usdValue}</span>
                  ) : null}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Recipient</label>
                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setContactsOpen((o) => !o)}
                    className="text-xs text-brand hover:opacity-80"
                  >
                    {contactsOpen ? "Hide contacts" : "Choose from contacts"}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setRecipientName("");
                }}
                placeholder="0x… Sui address"
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-4 py-3 focus:outline-none focus:border-brand/60 transition font-mono text-sm"
              />
              {recipientName && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sending to <span className="text-foreground font-medium">{recipientName}</span>
                </p>
              )}
              {contactsOpen && contacts.length > 0 && (
                <div className="mt-2 rounded-xl border border-border bg-card/60 divide-y divide-border max-h-56 overflow-y-auto">
                  {contacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setAddress(c.address);
                        setRecipientName(c.name);
                        setContactsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/60 transition"
                    >
                      <span className="w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {shortAddr(c.address)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!valid || submitting || !activeAccount}
              onClick={() => void goPrepare()}
              className="w-full rounded-full bg-brand text-brand-foreground font-semibold py-3.5 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Preparing…" : "Continue"}
            </button>
          </div>
        )}

        {step === "review" && prepareSummary && (
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-6">
            <h2 className="text-lg font-bold mb-1">Confirm transaction</h2>
            <p className="text-sm text-muted-foreground mb-6">Review the details before signing and sending.</p>

            <div className="rounded-xl border border-border bg-background/40 divide-y divide-border">
              <Row
                label="You send"
                value={`${prepareSummary.amountFormatted} ${prepareSummary.symbol}`}
              />
              <Row
                label="To"
                value={recipientName || shortAddr(address)}
                sub={recipientName ? shortAddr(address) : undefined}
              />
              <Row label="Network fee (max)" value={`~ ${prepareSummary.gasBudgetFormatted} SUI`} />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setPendingRequestId(null);
                  setPrepareSummary(null);
                }}
                className="flex-1 rounded-full border border-border py-3 text-sm font-medium hover:bg-secondary/50 transition"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void goConfirm()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand text-brand-foreground font-semibold py-3 hover:opacity-95 transition disabled:opacity-50"
              >
                <SendIcon className="w-4 h-4" />
                {submitting ? "Signing…" : "Confirm & Send"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-brand/15 text-brand flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">Transaction sent</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {prepareSummary?.amountFormatted} {prepareSummary?.symbol} submitted on-chain
              {doneDigest ? ` (digest ${shortAddr(doneDigest, 8, 6)})` : ""}.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                to="/activity"
                className="px-5 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-secondary/50 transition"
              >
                View activity
              </Link>
              <button
                type="button"
                onClick={() => navigate({ to: "/home" })}
                className="px-5 py-2.5 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-95 transition"
              >
                Back to home
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className="text-sm font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground font-mono">{sub}</p>}
      </div>
    </div>
  );
}
