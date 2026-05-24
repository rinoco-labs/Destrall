# 02 — Wallet System

## Responsibilities

The **wallet engine** is the **trusted execution layer** for custody and chain operations. It:

- Owns **account creation, import, and derivation** policy (with user-driven flows).
- Stores and uses **seed/key material** only inside the main process via **encrypted secure storage** (see `06-data-storage.md`).
- Exposes **chain-specific behavior** only through **adapter interfaces** so Solana, Sui, and future chains stay isolated.
- Serves **balances**, **send/receive** flows, **activity/history**, and **contacts**.
- Implements **transaction preparation**, **simulation** (when supported), **signing** (only after explicit user confirmation), and **execution/broadcast**.

## Account Creation and Import

- **Create**: Generate or accept entropy per product policy; persist encrypted wallet blob; never log raw mnemonic.
- **Import**: Accept mnemonic or hardware-backed flows as designed; same persistence rules.
- **Accounts**: Derivation indices, labels, and per-account settings are metadata in SQLite or equivalent; they **do not** replace encrypted key storage rules.
- **Terms and Conditions**: Before create or import, the user must explicitly accept the current Terms URL (`https://destrall.com/terms-and-conditions`) in onboarding UI. Acceptance is enforced in renderer handlers, IPC validation (`termsAccepted: true`), and `executeCreateOrImportWallet`. Metadata is written to `wallet_profile` only after a successful create/import: `accepted_terms`, `accepted_terms_at`, `accepted_terms_url`.

All flows that touch a **mnemonic** must be **short-lived in memory** and **user-initiated**; renderer never receives long-lived seed strings except through dedicated, audited IPC during create/import **only** if unavoidable—and prefer passing through UI layers that still never persist them in renderer storage.

## Seed and Key Management (Critical Rules)

1. **Private keys and seed phrases must never be exposed to renderer code** (no `window`, no React state, no `localStorage` in renderer).
2. **Signing must only happen in the main process** after gating.
3. **Every transaction must be user-confirmed before signing** (no batch auto-sign, no “remember yes for similar txs” that skips review in v1).
4. **AI and packages can only request transaction preparation** (build/simulate/present); they **cannot** invoke signing or hold keys.
5. **Chain-specific logic** belongs in **adapters** implementing a shared interface; the wallet engine orchestrates lifecycle and policy.

## Chain Adapters

Adapters encapsulate RPC shape, address encoding, fee rules, and serialization. The wallet engine selects an adapter by `chain` / network configuration.

### Suggested Interface

```typescript
interface PreparedTransaction {
  /** Opaque to UI: encoding, chain id, fee payer metadata as needed */
  chain: string;
  summary: TransactionSummary; // human-readable for confirmation UI
  raw: unknown; // chain-specific unsigned payload
}

interface SignedTransaction {
  chain: string;
  raw: unknown; // chain-specific signed payload
}

interface ChainAdapter {
  getBalance(params: GetBalanceParams): Promise<BalanceResult>;
  buildTransaction(params: BuildTransactionParams): Promise<PreparedTransaction>;
  simulateTransaction(tx: PreparedTransaction): Promise<SimulationResult>;
  signTransaction(tx: PreparedTransaction, accountId: string): Promise<SignedTransaction>;
  executeTransaction(tx: SignedTransaction): Promise<ExecutionResult>;
}
```

**Notes for implementers:**

- `signTransaction` is only callable from wallet code paths that have already verified **user confirmation** and **permissions** (no package/AI entrypoint).
- `simulateTransaction` should run **before** presenting the confirmation sheet when the chain supports meaningful simulation.
- `summary` must be sufficient for the user to understand asset movements without reading hex.

## Balances

- Fetched via adapters + RPC registry policy.
- Cached in SQLite or memory with TTL; cache is **non-authoritative** (always label stale state in UI if used).

## Send and Receive

- **Receive**: Show addresses/QR from main-derived metadata exposed over IPC (addresses are **not** secrets).
- **Send**: Renderer collects user intent (destination, amount, memo if any) → main **builds** → **simulates** (if supported) → **confirms** → **signs** → **executes**.

## Activity

- Persist **transaction history pointers** (signatures, hashes, timestamps) and **denormalized labels** for UX.
- Full chain re-org handling is chain-specific; adapter or indexer logic stays behind the adapter/wallet service boundary.

## Transaction Preparation

- Inputs: account, chain, recipient, amount, token id, fee preference.
- Output: `PreparedTransaction` + simulation result when available.
- **Packages** may contribute **templates** that **populate** `BuildTransactionParams`—they do not sign.

## Transaction Simulation

- When `simulateTransaction` is supported, results feed the confirmation UI (balance changes, program logs where applicable).
- If not supported, UI must clearly state limitations; still require explicit confirm.

## Transaction Signing

- Only after: valid IPC request, correct account unlocked (if applicable), schema validation, **explicit user confirmation** matching the prepared summary.
- **No AI auto-signing.** **No package signing.**

## Transaction Execution

- Broadcast / submit via adapter after signed payload is produced.
- Return execution result to UI; persist activity row.

## Contacts

- Stored as **non-secret** records (name, address, network) in local DB via main process; renderer reads through IPC.

## Local Wallet State

- Includes: encrypted vault, session state (locked/unlocked), active network, RPC endpoints, account list metadata, UI settings that affect wallet behavior.
- **Never** store private keys in plaintext files or renderer-accessible stores.

## Cross-References

- Security rules: `05-security-model.md`
- IPC shapes: `07-ipc-contracts.md`
- Storage layout: `06-data-storage.md`
