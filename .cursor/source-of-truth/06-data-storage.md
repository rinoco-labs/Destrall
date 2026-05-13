# 06 — Data Storage

## Goals

- **Local-first**: primary state lives on the user machine.
- **Minimize secret exposure**: keys and seeds are **encrypted**; large binaries are **files**, not SQLite BLOBs.
- **Clear separation** between **metadata**, **cache**, **models**, and **package artifacts**.

## SQLite Usage

SQLite holds **small, structured** rows:

- Wallet **metadata** (account labels, settings pointers—not cleartext keys).
- Assistant chats, threads, Daily Brief records, model selection metadata.
- Installed package index: **validated** manifest snapshots, versions, enable flags.
- Transaction/activity **cache** and denormalized labels.
- Contacts, RPC preferences, UI settings as designed.

**SQLite stores metadata, not large binaries.** Do not store GGUF weights or big HTTP payloads in rows.

## Encrypted Key Storage

- **Seed phrases / private keys** must use **encrypted secure storage** (platform keychain/OS APIs or audited crypto with strong KDF + local secret derived from user password—exact mechanism is implementation-specific).
- **Never** store seed or private keys in plaintext files or renderer-accessible `localStorage`.

## Model File Storage

- **GGUF** (and similar) models: **file-based** under e.g. `~/.destrall/models/<modelId>/...`.
- SQLite may store: path, checksum, size, install state, selected model id.

## Package Registry Storage

- **Cached** remote manifest JSON and download artifacts under user package directory.
- After validation, a **normalized manifest record** may live in SQLite for fast startup.
- **Package files/assets** live on disk under package storage; runtime reads from there.

## Assistant Memory / Context Storage

- Conversation history in SQLite (or chunked) with **user-visible delete**.
- Assistant message rows may include a **`metadata` JSON field** (versioned envelope) for **structured UI blocks** (portfolio cards, proposals, etc.) so rich content survives reloads alongside `content` text.
- Treat as **sensitive user data** at rest; consider encryption at rest for DB if threat model requires (product decision).

## Transaction / Activity Cache

- Store stable ids (tx hash, signature), timestamps, direction, token, amount, counterparty **labels**.
- Cache is **non-authoritative**; reconcile with chain on refresh.

## Settings

- Per-account or global settings: RPC endpoints, language, personality, feature flags.
- **Non-secret**; still validate on IPC to prevent oversized or malformed values.

## Recommended Directory Layout

```
~/.destrall/
  models/           # GGUF and model-related files (not in SQLite)
  packages/         # Installed package assets and bundles
  database.sqlite   # Metadata, chats, indexes (no private keys in plaintext)
  logs/             # Redacted logs only
  cache/            # HTTP or indexer cache with TTL/size caps
```

Paths are illustrative; use OS user-data conventions on Windows/Linux if not literally `~/.destrall/`.

## What Must Never Be Stored in Plaintext

- Seed phrases and mnemonic words.
- Private keys (chain-specific byte arrays).
- User passwords or PINs.
- Unredacted RPC responses that accidentally embed secrets (defensive logging policy).

## Cross-References

- Wallet rules: `02-wallet-system.md`
- IPC (no raw DB from renderer): `07-ipc-contracts.md`
