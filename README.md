# Destrall / Vault

**Vault** is a **local-first, self-custody desktop crypto wallet** with an **on-device AI assistant** and a **declarative extension system** (packages). **Destrall** is the implementation: an Electron app built with React, TypeScript, and Vite.

Your keys and signing stay in the **main process**. The UI, the language model, and third-party packages **propose** actions and context; they do **not** act as authorities over custody.

## What you can do

- **Hold and use crypto** — create or import a wallet, manage accounts, see balances, send and receive, and browse activity with explicit confirmation before every signature.
- **Understand your wallet locally** — chat with an assistant that runs **on your machine** (for example via GGUF models and **node-llama-cpp**), with optional summaries like a **Daily Brief** built from wallet-safe context (addresses, labels, activity—not seeds or keys).
- **Extend behavior safely (v1)** — install **packages** that declare permissions up front: read-only wallet snapshots, HTTP calls to allowlisted hosts, transaction **templates** that only **prepare** unsigned transactions, and static instructions for the assistant. Packages do **not** run arbitrary JavaScript or sign transactions in v1.

## How it works (at a glance)

1. **Electron split** — The **renderer** (React) drives the interface and calls a small **preload bridge**. The **main process** owns the wallet engine, chain **adapters**, IPC validation, encrypted key storage, local inference, and the package runtime.
2. **Request, then validate** — Sensitive steps follow **prepare → simulate (when supported) → confirm → sign → execute** in the main process. The renderer never holds private keys or signs.
3. **Untrusted inputs** — Treat renderer content, **model output**, and **package manifests** as untrusted until schema checks, permission checks, and (where required) your explicit confirmation say otherwise.
4. **Data on disk** — Metadata, chats, and indexes tend to live in **SQLite**; models and package assets live as **files** under user data (for example `~/.destrall/`). Key material uses **encrypted secure storage**, not plaintext in the database or web storage.

For full architecture, security rules, IPC expectations, storage layout, package contracts, and **v1 scope**, see **`.cursor/source-of-truth/`**. That folder is the **canonical project direction** for implementation and reviews; Cursor rules in **`.cursor/rules/`** point agents at those documents when making changes.

## Repository layout (high level)

| Path | Purpose |
|------|---------|
| `.cursor/rules/` | Agent rules (e.g. always consult source-of-truth) |
| `.cursor/source-of-truth/` | Canonical product and engineering reference |
| `source-of-truth/` | Same documents at repo root (e.g. for browsing on Git); keep in lockstep with `.cursor/source-of-truth/` |

When behavior or scope changes, update the relevant markdown under **`.cursor/source-of-truth/`** in the same change as the code so documentation and implementation stay aligned.
