# Vault / Destrall — Source-of-Truth Documentation

This folder is the **canonical technical reference** for Vault (the product surface) and Destrall (the Electron application). It defines product structure, system boundaries, security expectations, and implementation decisions that downstream code and reviews should align with.

## What Vault Is

**Vault** is a **local-first, self-custody crypto wallet** with a **locally running AI assistant** and an **extensible, declarative package system**. Sensitive custody and execution live in the trusted main process; the renderer, local LLM, and packages propose and request work but do not act as authorities over keys or signing.

**Destrall** is the Electron + React + TypeScript + Vite implementation. In documentation here, “Vault” refers to the product behavior and trust model; “Destrall” refers to the concrete app when naming paths, repos, or build artifacts.

## What This Set Covers

| Document | Focus |
|----------|--------|
| [01-product-architecture.md](./01-product-architecture.md) | Processes, subsystems, communication, trust boundaries |
| [02-wallet-system.md](./02-wallet-system.md) | Custody, adapters, transactions, signing rules |
| [03-local-ai-system.md](./03-local-ai-system.md) | Local LLM, context, structured intents, validation pipeline |
| [04-package-system.md](./04-package-system.md) | Manifests, permissions, declarative actions, v1 limits |
| [05-security-model.md](./05-security-model.md) | Threat model, non-negotiable rules |
| [06-data-storage.md](./06-data-storage.md) | SQLite, files, encryption, what must not be plaintext |
| [07-ipc-contracts.md](./07-ipc-contracts.md) | Preload bridge, channels, schema validation |
| [08-v1-scope.md](./08-v1-scope.md) | In-scope vs explicitly out-of-scope for v1 |

## How to Use These Docs

- **Implementers**: Treat unchecked behavior against these docs as a bug or a required doc update.
- **Reviewers**: Use security and IPC sections as mandatory checklists for risky changes.
- **Product**: v1 scope is bounded in `08-v1-scope.md`; do not infer commitments for areas not covered here.

When this documentation conflicts with legacy code, **either update the code to match this source of truth or update these files in the same change**—drift without an explicit decision is not acceptable.
