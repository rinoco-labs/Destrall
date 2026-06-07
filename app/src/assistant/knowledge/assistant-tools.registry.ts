import type { AssistantTool } from "./assistant-tools.types";

/**
 * Single source of truth for Assistant tool education, UI copy, and capability awareness.
 * Package action names are derived at runtime from manifests via packageIds.
 */
export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    id: "swap",
    title: "Swaps",
    category: "Trading",
    shortDescription: "Convert Sui tokens via the Aftermath Smart Order Router with a reviewable quote.",
    longDescription:
      "Destrall prepares swaps on Sui using the Aftermath router. You describe the amount, source token, and destination token; the Assistant fetches a live route, estimated output, and fees, then shows a swap proposal card. Nothing is sent until you approve. Quotes can move with market conditions — approve promptly or refresh if the card looks stale.",
    examples: [
      "Swap 1 SUI to USDC",
      "What tokens are available to swap?",
      "Convert 20 WAL to DEEP",
      "Swap half my USDC to SUI with 0.5% slippage",
    ],
    workflows: [
      "Ask for a swap in plain language (amount + from + to tokens).",
      "Review the proposal card: estimated output, route summary, and slippage tolerance.",
      "Approve once to sign and broadcast; results appear as a transaction card.",
    ],
    risks: [
      "Slippage: actual output can differ from the quote if the market moves before execution.",
      "Price volatility on volatile pairs.",
      "Router / liquidity risk on thin pools.",
      "Quotes expire — stale proposals may need to be rebuilt.",
    ],
    relatedTools: ["yield", "composite", "rebalancing"],
    assistantKeywords: [
      "swap",
      "trade",
      "convert",
      "exchange",
      "aftermath",
      "router",
      "slippage",
      "quote",
      "tokens",
    ],
    packageIds: ["core.swap.aftermath"],
  },
  {
    id: "send",
    title: "Send",
    category: "Transfers",
    shortDescription: "Transfer Sui tokens to a contact or address after you approve a send proposal.",
    longDescription:
      "Send moves tokens from your active Sui account to a saved contact, a SuiNS name, or a pasted address. The Assistant resolves the recipient (address → contact name → SuiNS) before building a send proposal with token, amount, and destination for your review.",
    examples: [
      "Send 10 USDC to Alex",
      "Transfer 0.5 SUI to 0xabc…",
      "Send my friend 100 WAL",
    ],
    workflows: [
      "Specify token, amount, and recipient (name or address).",
      "If multiple contacts match, pick the right one on the disambiguation card.",
      "Approve the send proposal to sign and broadcast.",
    ],
    risks: [
      "Irreversible on-chain transfers — double-check recipient and network.",
      "Sending to the wrong address cannot be undone.",
      "Gas fees apply on Sui.",
    ],
    relatedTools: ["contacts"],
    assistantKeywords: ["send", "transfer", "pay", "recipient", "address"],
    packageIds: ["core.wallet.send"],
  },
  {
    id: "yield",
    title: "Yield (Navi)",
    category: "Yield",
    shortDescription: "Supply assets to Navi lending pools, view APYs and positions, and withdraw with approval.",
    longDescription:
      "Yield features integrate Navi on Sui mainnet. You can list live pools and APYs, inspect your supply positions, and prepare deposits or withdrawals. Interest accrues on-chain; displayed APY is indicative and changes. Stablecoin pools often differ in risk profile from volatile asset pools. All deposits and withdrawals require explicit approval on proposal cards.",
    examples: [
      "What are my savings positions?",
      "What yield is available?",
      "Deposit 10 USDC into yield",
      "Deposit 20 USDC into Navi",
      "Withdraw my USDC from savings",
      "Show the highest APY pools",
    ],
    workflows: [
      "Ask to see pools or positions — live data appears on structured cards.",
      "For deposits/withdrawals, specify asset and amount; review the Navi proposal card.",
      "Approve to sign; accrued yield is reflected on-chain over time.",
    ],
    risks: [
      "Smart contract and protocol risk (Navi).",
      "Token volatility for non-stable supplies.",
      "APY changes frequently — headline rates are not guaranteed.",
      "Liquidity risk when withdrawing large positions.",
    ],
    relatedTools: ["composite", "triggers", "portfolio-analysis"],
    assistantKeywords: [
      "yield",
      "yields",
      "savings",
      "saving",
      "earn",
      "earning",
      "navi",
      "apy",
      "apys",
      "interest",
      "passive income",
      "lending",
      "supply",
      "deposit",
      "withdraw",
      "pool",
      "positions",
    ],
    packageIds: ["core.yield.navi"],
  },
  {
    id: "composite",
    title: "Composite actions",
    category: "Yield",
    shortDescription: "Multi-step flows like swap + deposit in one coordinated plan (often one PTB approval).",
    longDescription:
      "When your wallet holds a different asset than the yield pool you want, the Assistant can plan swap-then-deposit: convert to the pool asset, then supply to Navi. Composite flows may execute as a single Programmable Transaction Block (one approval) or as staged steps depending on the plan. The card shows each leg before you approve.",
    examples: [
      "Deposit 50% of my USDC into the highest APY pool",
      "Swap my SUI to USDC and deposit into Navi",
      "Put 100 WAL into the best yield pool",
    ],
    workflows: [
      "Describe the outcome (e.g. deposit X into best pool) even if you hold another token.",
      "Assistant may swap first, then deposit, inside one coordinated flow.",
      "Review the composite card showing steps and estimated amounts.",
      "Approve once (PTB) or per stage as shown on the card.",
    ],
    risks: [
      "Combines swap slippage with yield protocol risk.",
      "Estimated deposit amounts can shift if the swap leg moves.",
      "Multi-leg failures require reading the result card carefully.",
    ],
    relatedTools: ["swap", "yield", "rebalancing"],
    assistantKeywords: ["swap then deposit", "composite", "staged", "ptb", "multi-step"],
    packageIds: ["core.composite", "core.swap.aftermath", "core.yield.navi"],
  },
  {
    id: "triggers",
    title: "Triggers",
    category: "Automation",
    shortDescription: "Pre-approved automation for price rules, schedules, and recurring yield actions.",
    longDescription:
      "Triggers let you save rules such as “sell 10 SUI if price goes above $5” or “collect yield every day at 10am.” Creating a trigger always shows a review card — nothing is saved until you pre-approve limits. Active triggers are monitored while Destrall is running; pause, resume, or delete from the Triggers page or via chat. Execution stays within what you approved on the card.",
    examples: [
      "If SUI goes above $5 sell 10 SUI",
      "Collect my yield every day at 10am",
      "List my triggers",
      "Pause my SUI price trigger",
    ],
    workflows: [
      "Describe the condition and action in natural language.",
      "Review the trigger proposal: asset, limits, schedule, and timezone.",
      "Tap Approve Trigger to save; monitoring begins while the app runs.",
      "Manage triggers from chat or the Triggers screen.",
    ],
    risks: [
      "Price can move before execution; quotes on swap triggers may change.",
      "Automation only runs while the app can monitor (not a background server).",
      "Pre-approved limits must be set carefully — execution is automatic within bounds.",
    ],
    relatedTools: ["scheduled-actions", "swap", "yield"],
    assistantKeywords: [
      "trigger",
      "automation",
      "automate",
      "if price",
      "when",
      "schedule",
      "recurring",
      "pause",
      "resume",
    ],
    packageIds: ["core.triggers"],
  },
  {
    id: "scheduled-actions",
    title: "Scheduled actions",
    category: "Automation",
    shortDescription: "Time-based triggers using your local timezone — daily, weekly, or one-off schedules.",
    longDescription:
      "Scheduled actions are triggers driven by clock time (for example “every Monday at 9am” or “tomorrow at 3pm”). The Assistant uses your configured timezone for display and scheduling. Like all triggers, they require explicit approval on a proposal card before being saved.",
    examples: [
      "Remind me to check yield every morning at 8",
      "Run my rebalance every Sunday at noon",
      "What triggers are scheduled today?",
    ],
    workflows: [
      "State the schedule clearly (time, repeat pattern, and action).",
      "Confirm AM/PM if the Assistant asks for clarification.",
      "Approve the scheduled trigger card to activate monitoring.",
    ],
    risks: [
      "Device must be awake and Destrall running near the scheduled time.",
      "Timezone changes can shift next-run times — verify on the card.",
    ],
    relatedTools: ["triggers"],
    assistantKeywords: ["schedule", "scheduled", "daily", "weekly", "every day", "at 10", "cron"],
    packageIds: ["core.triggers", "core.time"],
  },
  {
    id: "rebalancing",
    title: "Rebalancing",
    category: "Portfolio",
    shortDescription: "Target allocation percentages turned into a swap plan you approve before execution.",
    longDescription:
      "Rebalancing compares your current holdings to target weights you describe (for example 30% SUI, 20% DEEP, rest USDC). The Assistant calculates required trades and shows a rebalance proposal with swap legs — often combined in one PTB on Sui. It does not trade without your approval.",
    examples: [
      "Rebalance to 30% SUI, 20% DEEP, rest USDC",
      "Rebalance my portfolio",
      "Adjust to 40% stablecoins",
    ],
    workflows: [
      "Provide target percentages that sum to 100% (or follow the Assistant’s prompt).",
      "Review swap legs, estimated sizes, and fees on the rebalance card.",
      "Approve to execute the planned trades.",
    ],
    risks: [
      "Trading costs and slippage across multiple legs.",
      "Tax implications may apply — Destrall does not provide tax advice.",
      "Small balances may be skipped or rounded.",
    ],
    relatedTools: ["swap", "portfolio-analysis"],
    assistantKeywords: ["rebalance", "allocation", "diversify", "target", "weights", "mix"],
    packageIds: ["core.rebalance", "core.swap.aftermath"],
  },
  {
    id: "portfolio-analysis",
    title: "Portfolio analysis",
    category: "Portfolio",
    shortDescription: "Concentration, idle assets, stable exposure, and yield fit using live wallet context.",
    longDescription:
      "The Assistant analyzes your cached balances and Navi positions to comment on concentration, diversification score, stablecoin exposure, and idle capital. It can suggest yield opportunities when mainnet pool data is available, aligned to your yield risk profile setting. Analysis is educational — not investment advice.",
    examples: [
      "How risky is my portfolio?",
      "What should I rebalance?",
      "What assets are idle?",
      "Show my portfolio",
      "What's my balance?",
    ],
    workflows: [
      "Ask analytical questions about holdings or risk.",
      "Assistant uses live context and may show portfolio or pool cards.",
      "Follow up with a concrete proposal (swap, yield, rebalance) if you want action.",
    ],
    risks: [
      "Heuristic scores are simplified — not a full risk model.",
      "USD values depend on available price feeds.",
    ],
    relatedTools: ["rebalancing", "yield", "portfolio-insights"],
    assistantKeywords: [
      "portfolio",
      "risk",
      "concentration",
      "diversification",
      "idle",
      "balance",
      "holdings",
      "exposure",
    ],
    packageIds: ["core.portfolio", "core.yield.navi"],
  },
  {
    id: "contacts",
    title: "Contacts",
    category: "Transfers",
    shortDescription: "Saved recipients for sends — scoped to your account and used for name resolution.",
    longDescription:
      "Contacts store friendly names and Sui addresses. When you send by name, the Assistant searches your scoped contact list and may ask you to pick among matches. Contacts are managed on the Contacts page; the Assistant reads them but does not create on-chain entries.",
    examples: ["Send 5 SUI to Maria", "Who are my contacts?"],
    workflows: [
      "Add contacts on the Contacts screen.",
      "Refer to them by name in send requests.",
      "Disambiguate on the card if multiple matches exist.",
    ],
    risks: ["Outdated addresses in contacts lead to wrong sends — verify on the proposal card."],
    relatedTools: ["send"],
    assistantKeywords: ["contact", "contacts", "recipient", "friend"],
    packageIds: ["core.contacts", "core.wallet.send"],
  },
  {
    id: "portfolio-insights",
    title: "Portfolio insights",
    category: "Insights",
    shortDescription: "Daily Brief and proactive signals — concentration, yield ideas, and activity highlights.",
    longDescription:
      "Portfolio insights include the Daily Brief on Home (portfolio snapshot, yield opportunities, risk notes, and activity) and contextual triggers the Assistant may mention when relevant. These features read wallet and market data the app already fetched — they do not execute trades by themselves.",
    examples: [
      "Open my daily brief",
      "What changed in my portfolio today?",
      "Any yield opportunities?",
    ],
    workflows: [
      "Open Home or Daily Brief for a structured overview.",
      "Ask the Assistant to elaborate on a specific insight from context.",
      "Request a proposal if you want to act on a suggestion.",
    ],
    risks: [
      "Brief content is point-in-time — refresh for latest balances.",
      "Opportunity labels are heuristic, not guarantees.",
    ],
    relatedTools: ["portfolio-analysis", "yield"],
    assistantKeywords: ["daily brief", "insight", "brief", "opportunity", "signal"],
    packageIds: ["core.portfolio", "core.yield.navi"],
  },
  {
    id: "transaction-proposals",
    title: "Transaction proposals",
    category: "System",
    shortDescription: "Structured cards for every on-chain action — review, approve, or dismiss.",
    longDescription:
      "Proposal cards are how Destrall keeps you in control. Swaps, sends, Navi deposits/withdrawals, composite flows, rebalances, and new triggers all appear as cards in Assistant chat (and sometimes on dedicated screens). Approve runs the wallet flow; Dismiss clears the suggestion without signing. Pending proposals stay in chat context until resolved.",
    examples: [
      "What is this card?",
      "How do I approve?",
      "Reject this swap",
    ],
    workflows: [
      "Assistant attaches a card when an action is ready.",
      "Read amounts, tokens, addresses, and warnings on the card.",
      "Use Approve or Dismiss on the card — text alone cannot submit transactions.",
    ],
    risks: [
      "Approving signs with your wallet — always verify details on the card.",
      "Never approve if amounts or recipients look wrong.",
    ],
    relatedTools: ["swap", "send", "yield", "triggers", "rebalancing"],
    assistantKeywords: ["proposal", "approve", "card", "confirm", "dismiss"],
    packageIds: [],
  },
];

const TOOL_BY_ID = new Map(ASSISTANT_TOOLS.map((t) => [t.id, t]));

export function getAssistantTool(id: string): AssistantTool | undefined {
  return TOOL_BY_ID.get(id);
}

export function listAssistantTools(): AssistantTool[] {
  return ASSISTANT_TOOLS;
}
