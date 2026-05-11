# 01 — Product Architecture

## High-Level Shape

Vault is an **Electron** desktop application: a **main process** owns custody, persistence, IPC validation, and privileged operations; **renderer processes** (React + TypeScript + Vite + Tailwind + Radix UI) drive UI and user intent. A **local AI runtime** and a **declarative package runtime** run under main-process policy: they enrich proposals and context but **never** become a signing authority.

## Electron: Main vs Renderer

| Responsibility | Main process | Renderer |
|----------------|--------------|----------|
| UI | No | Yes (React) |
| Private keys / seed material | Yes (secure handling only) | **Never** |
| Transaction signing | Yes (after user confirmation) | **Never** |
| IPC handler registration, validation | Yes | Invokes bridge only |
| Local LLM inference (e.g. node-llama-cpp) | Yes (typical placement) | **No** direct model access |
| Package manifest parse, action execution | Yes (runtime enforces permissions) | Requests via bridge |
| SQLite / encrypted stores | Yes | **No** raw DB access |
| User gestures / screens | Via UI events only | Origin of requests |

**Required principle:** The **renderer UI requests actions**. The **main process validates and executes** sensitive work. The **AI and packages propose** (structured intents, templates, read results) but **never directly execute** sensitive wallet operations (signing, key export, unrestricted chain execution).

## Trusted vs Untrusted Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ TRUSTED COMPUTING BASE (main process + validated IPC handlers)   │
│  - Wallet engine                                                  │
│  - Chain adapters                                                 │
│  - Encrypted key storage                                          │
│  - Schema validation, permission checks                           │
│  - Transaction simulation (where supported)                       │
│  - User-confirmation gates before sign                            │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ validated IPC      │ validated IPC      │ structured + validated
         │                    │                    │
┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐
│ Renderer (UI)   │  │ Local AI output │  │ Package manifests│
│ UNTRUSTED       │  │ UNTRUSTED       │  │ UNTRUSTED until │
│                 │  │                 │  │ validated       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

- **Renderer**: Treat as compromised-capable (XSS, malicious extensions, devtools). No secrets, no signing.
- **LLM output**: Treat as **untrusted**; only **structured, schema-validated** intents may drive execution.
- **Packages**: Declarative only in v1; manifests and registry metadata are untrusted until validated and permission-checked.

## Major Subsystems

1. **Wallet engine**  
   Account model, session lock/unlock, chain **adapter** interfaces, balance/activity aggregation, transaction **prepare → simulate → confirm → sign → execute** pipeline.

2. **Local AI runtime**  
   Model load/inference (e.g. **node-llama-cpp**), context builders, tool/action orchestration. Produces **structured intents**, not direct chain calls.

3. **Package runtime**  
   Installed declarative packages: **permissions**, **actions** (read state, HTTP, transaction templates, local instructions). **No arbitrary JavaScript** in v1.

4. **Local database / storage**  
   SQLite for metadata, settings, chat, package index; **files** for GGUF models and package assets; **encrypted** stores for key material.

5. **Security layer**  
   Centralized rules: IPC schema validation, permission matrix for package actions, mandatory user confirmation for signing, simulation before sign when the chain adapter supports it.

## How Systems Communicate

```
                    ┌──────────────┐
                    │   Renderer   │
                    │  (Vault UI)  │
                    └──────┬───────┘
                           │ preload bridge (narrow API)
                           ▼
                    ┌──────────────┐
                    │ Main process │
                    │  IPC handlers│
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │   Wallet   │  │  Local AI  │  │  Packages  │
    │   engine   │  │  + SQLite  │  │  runtime   │
    └────────────┘  └──────┬─────┘  └──────┬─────┘
                           │               │
                           └───────┬───────┘
                                   ▼
                         Structured intents /
                         template prepare only
                                   │
                                   ▼
                         Main: validate → confirm → sign
```

- UI, AI, and packages **converge on main-process APIs** after validation.
- **No** “generic execute” path that runs unreviewed code or payloads from renderer/AI/packages.

## Text Architecture Diagram (Layers)

```
┌─────────────────────────────────────────────────────────────┐
│ Presentation (untrusted): React renderer                 │
├─────────────────────────────────────────────────────────────┤
│ Bridge (trusted narrow surface): contextIsolation preload  │
├─────────────────────────────────────────────────────────────┤
│ Policy (trusted): schemas, permissions, confirmations       │
├─────────────────────────────────────────────────────────────┤
│ Domain (trusted): wallet engine, adapters, LLM, packages   │
├─────────────────────────────────────────────────────────────┤
│ Persistence (trusted): SQLite, encrypted vault, file stores  │
└─────────────────────────────────────────────────────────────┘
```
