# 08 — v1 Scope

This document bounds **v1** so implementation stays coherent. Features not listed as included are **not v1 commitments** unless explicitly promoted here in a future revision.

## v1 Includes

### Wallet

- **Create / import** wallet flows with main-process custody.
- **Account management** (create account, labels, basic settings).
- **Balances** and **send / receive** flows with user confirmation before signing.
- **Transaction history** / activity views (local cache + refresh).
- **Contacts** (local, non-secret records).
- **Transaction simulation** when the relevant **chain adapter** supports it.
- **User confirmation before signing** for every signing operation.

### Local AI

- **Local AI chat** using on-device inference (e.g. **node-llama-cpp**).
- **Local model install** for a **single built-in** on-device assistant model; weights stored as **files** under user data (e.g. `~/.destrall/models/`).
- **Daily Brief** using wallet-aware, **local** context.
- **Wallet-aware assistant context** via trusted context providers (non-secret snapshots).
- **Structured intents** validated before any sensitive work.

### Packages

- **Install / remove** packages (registry or local bundle flows as implemented).
- **Package manifest validation** and **declared permissions**.
- **Package-defined read actions** (`wallet.read` class capabilities).
- **Package-defined HTTP actions** with host/method allowlists.
- **Package-defined transaction templates** (**prepare-only**).
- **Runtime validation** of every package action invocation.

### Security / Architecture

- **Strict IPC boundaries** with schema validation.
- **Main-process-only signing**; **no renderer private keys**.
- **AI-assisted but app-validated** workflows; **no AI auto-signing**.

## v1 Excludes

Documentation and v1 product commitments **do not** cover:

- **Arbitrary package JavaScript** execution.
- **Package background daemons** or long-running unreviewed processes.
- **AI autonomous signing** or **AI autonomous transaction execution**.
- **Cloud-hosted AI** as a required dependency for core flows.
- **Remote code execution** channels.
- **Package-to-package** communication mesh.
- **Multi-agent** orchestration beyond a single local assistant runtime.
- **Social features** (feeds, follows, public profiles as product surface).
- **Cloud sync** of wallet secrets or full state replication to vendor servers.

## Implications for Engineering

- If a feature appears in code but is **excluded** here, treat it as **experimental** or **legacy** until the doc set is updated with an explicit decision.
- If a feature is **included** here but missing in code, track it as **required work** or revise scope deliberately.

## Versioning of This Document

When v2 is defined, duplicate this file to `08-v2-scope.md` (or equivalent process) rather than silently expanding v1.
