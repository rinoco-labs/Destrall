# 05 — Security Model

This document is **blunt and strict**. If a feature conflicts with these rules, the feature is wrong until the docs and threat model are explicitly revised.

## Trust Boundaries

| Zone | Trust level |
|------|-------------|
| Main process (wallet, IPC handlers, validation, encrypted stores) | **Trusted** |
| Preload bridge (narrow, typed API) | **Trusted surface**, must stay minimal |
| Renderer (React, any third-party script) | **Untrusted** |
| Local LLM output | **Untrusted** |
| Package manifests and assets (pre-validation) | **Untrusted** |
| Remote package registry metadata | **Untrusted** |
| Remote HTTP responses | **Untrusted** (sanitize, size-limit, schema-bound) |

## Renderer Threat Model

Assume:

- XSS or malicious dependency can run in renderer.
- User may paste attacker-controlled content into chat or forms.
- DevTools or extensions may inspect or tamper with renderer memory.

**Therefore:**

- **Renderer is untrusted.**
- **No private keys or seed phrases in renderer** (memory, storage, or props).
- Renderer may **request** balances or prepared transactions; it may **not** sign.

## AI Threat Model

Assume:

- Prompt injection attempts via chat, transaction memos, address labels, or package-supplied text.
- Model hallucination fabricates “confirmed” transactions or fake policies.
- Model tries to emit tool calls that exfiltrate secrets.

**Therefore:**

- **AI output is untrusted.**
- Only **structured, schema-validated** intents can trigger actions.
- **No AI auto-signing** and **no AI autonomous transaction execution.**
- Context builders must **not** include signing material or recovery phrases in prompts.
- Treat model text as **UX copy**, not authorization.

## Package Threat Model

Assume:

- Malicious author declares misleading `description` fields.
- Manifest requests excessive permissions.
- HTTP actions try to hit unexpected endpoints via bugs (must be blocked by allowlists).
- Transaction templates try to drain funds (user confirmation + simulation mitigate; templates are still adversarial).

**Therefore:**

- **Package manifests are untrusted until validated** against schema and policy.
- **Every package action must be permission-checked** on every invocation.
- **Packages cannot access keys, cannot sign, cannot execute arbitrary code (v1).**
- **Packages cannot bypass permissions** or call raw IPC.

## IPC Validation

- **Every IPC request must be schema-validated** (types, bounds, enums). Reject unknown fields if using strict mode.
- **No raw private key IPC** and **no raw seed phrase IPC** except within narrowly audited create/import flows—and prefer zero renderer exposure even there.
- **No generic “execute anything” IPC endpoint.**

## Permission Checks

- Intersect **declared package permissions** with **action requirements** before execution.
- Deny by default: unknown permission strings fail closed.

## Transaction Confirmation

- **Every signing request must require explicit user confirmation** tied to a **human-readable summary** of effects.
- **Every transaction must be simulated before signing when supported** by the chain adapter. If simulation is unavailable, UI must state the risk clearly; v1 still requires explicit confirm.

## Prompt Injection

Risks:

- Hidden instructions in on-chain or off-chain metadata surfaced in the wallet (e.g. NFT or token display fields), token names, or address labels.
- Package-supplied instructions influencing the model to misuse tools.

Mitigations:

- **System prompts are not sufficient security.** Enforce **schemas** and **allowlists**.
- Separate **tool allowlists** from **user text**; never pass user text as system policy.
- Log and rate-limit suspicious tool-call patterns (implementation detail).

## Local Storage Risks

- SQLite file theft exposes **metadata and possibly chat**—not acceptable for keys; keys must live in **encrypted secure storage** with OS-backed protection where available.
- Logs must **redact** mnemonics, private keys, and passwords.

## Package Install Risks

- Supply-chain: compromised registry or MITM download. Mitigate with **TLS**, **hash verification**, optional **code signing**, and **manual trust** for sideloaded bundles.
- **Post-install**: disabling a package must immediately remove its tools from assistant routing.

## Required Security Rules (Checklist)

1. **Only the main process** can access sensitive wallet operations (keys, sign, decrypt vault).
2. **Every IPC request** must be **schema-validated**.
3. **Every package action** must be **permission-checked**.
4. **Every transaction** must be **simulated before signing when supported**.
5. **Every signing request** must require **explicit user confirmation**.
6. **Renderer is untrusted.**
7. **AI output is untrusted.**
8. **Package manifests and remote metadata are untrusted until validated.**

## Repeated Non-Negotiables

- **No renderer access to private keys.**
- **No AI auto-signing.**
- **No arbitrary JavaScript execution in packages (v1).**
- **No unrestricted filesystem or raw database IPC from renderer.**
