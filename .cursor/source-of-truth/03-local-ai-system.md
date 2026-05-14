# 03 — Local AI System

## Purpose

The **local AI assistant** helps users understand their wallet, summarize activity, draft plans, and **propose** next steps using **on-device** inference. It is **not** a trust root: all **sensitive actions** require **app validation** and **user confirmation** before main-process execution.

## Runtime: node-llama-cpp

- Inference runs in the **main process** (or a tightly controlled main-owned worker), not in the renderer.
- **node-llama-cpp** loads **GGUF** weights from disk and runs generation with bounded context.

## Model Storage

- **Default path**: `~/.destrall/models/` (product-specific; adjust only with migration docs).
- Models are **files on disk**, not BLOBs inside SQLite.
- Install flow: download or import → verify checksum/size policy → register in local metadata.

## Model Install (single built-in assistant)

- **Install**: User-initiated download of one on-device GGUF bundle; progress events surface to UI via IPC.
- **Persistence**: Persist install metadata (paths, status, timestamps) in **SQLite** under a stable internal logical id (not user-selectable).
- Replacing weights in a future version must follow migration notes so conversation storage rules in `06-data-storage.md` stay consistent.

## SQLite Persistence (AI-Related)

Stores may include:

- Chat threads and messages (content may be sensitive—treat as user data at rest per security policy).
- Assistant runtime flags, personality ids, language.
- Daily Brief records and scheduling metadata.

Large embeddings or model weights **do not** belong in SQLite.

## Daily Brief

- A scheduled or on-demand **summary** of wallet-relevant signals (balances, recent txs, package-surfaced insights).
- Generated with **local** context providers; **no cloud-hosted AI dependency** in v1 scope.

## Wallet-Aware Assistant Context

Context builders attach **non-secret** or **explicitly approved** snapshots to the prompt:

- Public addresses, chain ids, token symbols, recent activity labels.
- User-approved package read results.
- **Never** attach private keys, seed phrases, or raw signing material.

**System prompt (single source of truth):** assistant identity, safety rules, and finance-copilot behavior live in `app/src/assistant/systemPrompt.ts` (`buildDestrallAssistantSystemPrompt`). Runtime context assembly is **`app/src/assistant/contextBuilder.ts`** (`buildCompactAssistantContext`) using **`app/src/assistant/cache/assistantDataCache.ts`** (TTL + stale-while-revalidate for balances, activity, Navi pools, positions). Deterministic routing (cards first, optional LLM skip) lives in **`app/src/assistant/intentPlanner.ts`** (`planAssistantStructuredTurn`). Portfolio heuristics remain in `app/src/assistant/recommendationEngine.ts` / `portfolio-analysis.service.ts` — avoid duplicating long prompt text elsewhere.

## Context Providers

Modular providers assemble structured context:

- `WalletSnapshotProvider` — balances, networks, account labels.
- `ActivityProvider` — recent txs (redacted as needed).
- `PackageContextProvider` — outputs of **read-only** package actions allowed by permissions.

Providers run in the **trusted** main process; the LLM only sees **serialized** context strings or structured blocks prepared by the app.

## Action Orchestration

The assistant may emit **tool calls** or **action requests** aligned with the **package/runtime action registry**. Orchestration steps:

1. Map LLM output to a **structured intent** (JSON schema).
2. Validate intent against **action definitions** and **permissions**.
3. Execute **only** through the same execution path as UI-initiated actions (no special “AI bypass”).

## Tool / Action Calling Model

- Tools are **allowlisted** capabilities: e.g. `wallet.read`, `transaction.prepare`, `http.fetch` to approved hosts.
- The LLM receives **schemas** describing tools; responses must conform to **structured output** contracts.

## Structured Intent Parsing

- Raw natural language is **not** executed.
- Parser converts model output to **`StructuredIntent`** objects: `{ kind, actionId?, args?, rationale? }` with strict typing.
- Malformed output → user-visible error, no side effects.

## Safety Validation

- **Intent validator**: rejects unknown actions, oversize payloads, wrong account scope.
- **Permission layer**: intersects intent with installed package permissions and global policy.
- **Confirmation layer**: any sensitive mutation or signing requires UI confirmation.

## Critical Rules

1. The **LLM must not directly execute wallet actions** (no direct adapter calls from model code paths).
2. The **LLM must produce structured intents** (or purely informational text with **no** side effects).
3. **Structured intents must be validated** before execution.
4. **Any sensitive action** must pass through **app validation** and **user confirmation**.
5. **Local AI is untrusted output**, not authority—UI copy should not imply “the model approved this transaction.”

## End-to-End Flow (Required)

```
User request
  ↓
Assistant context builder
  ↓
Local LLM inference
  ↓
Structured intent parser
  ↓
Action validator
  ↓
Permission / security layer
  ↓
User confirmation if required
  ↓
Main-process execution
```

## Boundaries vs Packages

- Packages declare **actions** and **instructions for AI** (prompt scaffolding, examples).
- The LLM may **select** among declared package actions; execution still goes through **runtime permission checks**.

## Out of Scope (v1)

- Multi-agent orchestration, autonomous loops, or cloud inference—see `08-v1-scope.md`.
