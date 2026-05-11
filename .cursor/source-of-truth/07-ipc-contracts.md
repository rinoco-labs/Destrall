# 07 — IPC Contracts

## Design Principles

1. **Narrow surface**: preload exposes the smallest possible API; no `ipcRenderer.invoke` in renderer.
2. **Schema-first**: every payload is validated in the main process before use.
3. **No secrets to renderer**: signing inputs are presented as **already-prepared** transactions plus user password/session unlock via **main-only** handling—never return private keys.
4. **No escape hatches**: no generic command execution, no raw filesystem, no raw SQL from renderer.
5. **Symmetric errors**: use typed `RpcResult<T>` (or equivalent) for predictable UI handling.

## Renderer-to-Main Calls

- Implemented with `ipcMain.handle` + `ipcRenderer.invoke` (or secure wrappers).
- Each channel maps to **one** responsibility; avoid “god channels.”

## Main-to-Renderer Events

- Use `webContents.send` for **notifications**: model download progress, async wallet updates, etc.
- Subscriptions exposed on the bridge as `onX(listener): unsubscribe` patterns (see preload patterns).

## Schema Validation

- Validate **arguments** and **return shapes** where feasible (e.g. Zod/JSON Schema).
- Reject unknown keys for security-sensitive handlers.
- Normalize strings (trim, max length) before persistence.

## Request / Response Patterns

- Prefer **idempotent reads** (`wallet.list`, `wallet.balances`) vs **mutations** (`wallet.createOrImport`).
- Long operations: return job id + progress events, or stream via events.

## Error Handling

- Never leak stack traces to renderer in production builds.
- Map internal errors to **safe, user-actionable** messages.

## Permission Enforcement

- IPC handlers are **not** a permission bypass for packages: package-initiated work still goes through **runtime action** checks.
- Wallet signing handlers must verify **UI confirmation token** or equivalent **main-process gate** (not “honor system” from renderer booleans alone—pair with secure UX flows).

## Safe Preload API

The bridge is exposed via `contextBridge.exposeInMainWorld`. **Conceptual** Vault API (names illustrative):

```typescript
// Conceptual: safe preload bridge — not direct main internals
window.vault.wallet.getBalances();
window.vault.wallet.prepareTransaction();
window.vault.assistant.sendMessage();
window.vault.packages.installPackage();
```

**Important:** These are **safe façade methods** that forward to validated IPC. They **do not** expose Node, filesystem, or `ipcRenderer` directly to untrusted code.

The concrete global name is an implementation detail (e.g. `window.destrallApi` with nested `wallet`, `assistant`, `llm`, `packageRegistry`, etc.). New code should converge on **one** stable bridge shape and document it in code next to `preload.ts`.

## Critical IPC Rules

1. **No raw private key IPC** (either direction).
2. **No raw seed phrase IPC** after the narrow create/import flow completes—ideally **never** to renderer at all.
3. **No generic execute IPC endpoint** (no arbitrary code, SQL, shell).
4. **No unrestricted filesystem IPC** from renderer.
5. **No direct database IPC** from renderer—main process owns persistence services.
6. **All IPC payloads must be validated** with strict schemas.

## Example Handler Contract (Illustrative)

```typescript
// Main: pseudo-code
ipcMain.handle("wallet:prepareTransaction", async (_event, raw) => {
  const input = PrepareTransactionSchema.parse(raw); // throws → safe error
  return await walletService.prepare(input);
});
```

## Events vs Invoke

| Pattern | Use for |
|---------|---------|
| `invoke` / `handle` | Request/response, mutations, reads |
| `send` / `on` | Progress, streaming tokens (if ever exposed), background updates |

## Cross-References

- Security: `05-security-model.md`
- Wallet lifecycle: `02-wallet-system.md`
