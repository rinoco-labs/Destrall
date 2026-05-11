# 04 — Package System

## Purpose

**Packages** extend what the assistant and wallet UX can **reason about** and **prepare**, using a **declarative manifest** and a **permissioned action runtime**. They let third-party or first-party contributors ship **workflows** and **read/model** helpers without **arbitrary code execution** in v1.

## Package Store

- **Registry**: Remote or local source of signed/validated manifests and downloadable artifacts (implementation-specific). **Remote metadata is untrusted** until verified (schema, signatures, review policy—per product roadmap).
- **Local store**: Installed package files live under user data (see `06-data-storage.md`).

## Install, Remove, Update

- **Install**: Fetch or select bundle → **validate manifest** → verify permissions → extract assets → register in local index.
- **Remove**: Delete artifacts + revoke registry entries; clear assistant tool registrations from that package id.
- **Update**: Semver (or explicit version pins); migration runs only for **data** the app owns—packages cannot run migration scripts in v1 beyond declarative schema compatibility checks.

## Package Manifests

A manifest describes **identity**, **version**, **permissions**, and **actions**. It must parse against a **strict schema** before install completes.

## Versioning

- **`version`**: package semver string consumed by the installer and UI.
- **Compatibility**: optional `engine` / `appMinVersion` fields as needed; reject incompatible installs at validation time.

## Permissions

Permissions are **capability tokens** enforced by the runtime **before** every action. Examples (illustrative; exact enum is code-defined):

- `wallet.read` — structured read-only wallet state via allowlisted selectors.
- `http.fetch` — HTTP GET/POST to **allowlisted** hosts/methods/paths.
- `transaction.prepare` — populate **transaction templates** only (unsigned).
- `assistant.instruction` — contribute prompt snippets / structured examples (no code).

**Packages cannot broaden permissions at runtime** beyond the granted set.

## Declared Actions

Each action has:

- Stable **`id`** (unique within package).
- **`type`**: drives executor (`wallet-read`, `http`, `transaction-template`, `local-instruction`, etc.).
- **`description`**: for UI and model routing.
- **`inputSchema`**: JSON Schema or equivalent for validation.

Runtime builds a **namespaced** action name (`packageId.actionId`) to avoid collisions.

## Package Instructions for AI

- Optional blocks: **approved prompt fragments**, **few-shot examples**, **parameter hints**.
- These are **data**, not executable JS. The assistant runtime injects them only for installed, enabled packages.

## Transaction Templates

- **Prepare-only**: templates map inputs → `BuildTransactionParams` / adapter inputs.
- **No signing**: signing keys never enter package execution context.
- User must still **confirm** in the wallet UI before sign.

## HTTP Actions

- Restricted to declared methods, hosts, and rate limits.
- Response size caps; no credential exfiltration channels via package-defined headers beyond fixed templates.

## Read-Only Wallet State Actions

- Return **JSON-serializable** snapshots defined by the app (balances, token list, etc.).
- No raw key export, no signing.

## Local Instructions

- Static content bundled with the package (markdown/JSON) for assistant context or UI help.
- Validated for size and encoding at install time.

## v1: No Arbitrary JavaScript Execution

- **No** user-supplied or package-supplied JS VM in the package runtime for v1.
- **No** `eval`, dynamic `Function`, or WASM modules unless explicitly added in a **future** version with a separate threat model (not v1).

## Critical Rules

1. **Packages are declarative** (manifest + assets + schemas).
2. **Packages cannot access keys** or signing interfaces.
3. **Packages cannot sign transactions** or call sign IPC.
4. **Packages cannot execute arbitrary code** (v1).
5. **Packages cannot bypass permissions** (no hidden channels).
6. **Packages cannot call unrestricted IPC**—only runtime-mediated APIs.
7. **Package actions must be validated** by the runtime on every invocation (schema + permission + account scope).
8. **Transaction templates are prepare-only**; execution is user-confirmed wallet flow.

## Example Manifest

```json
{
  "id": "com.example.yield",
  "name": "Example Yield Package",
  "version": "1.0.0",
  "permissions": [
    "wallet.read",
    "http.fetch",
    "transaction.prepare"
  ],
  "actions": [
    {
      "id": "getPositions",
      "type": "wallet-read",
      "description": "Read user positions"
    },
    {
      "id": "fetchMarketData",
      "type": "http",
      "description": "Fetch market data from approved endpoints"
    },
    {
      "id": "prepareDeposit",
      "type": "transaction-template",
      "description": "Prepare a deposit transaction"
    }
  ]
}
```

## Relationship to Runtime Types

Implementation may align action `type` strings with internal enums, e.g.:

- `read_state` | `http` | `transaction_template` | `local_instruction` | …

Names in manifests should map 1:1 in the installer validation layer.

## Cross-References

- Security: `05-security-model.md`
- IPC for install/validate: `07-ipc-contracts.md`
- v1 boundaries: `08-v1-scope.md`
