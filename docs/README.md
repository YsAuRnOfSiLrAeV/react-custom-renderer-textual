# Documentation

This directory is organized by runtime responsibility.

## Structure

### `architecture/`

Cross-runtime documentation:
- `architecture.md` - high-level system shape and responsibilities
- `protocol.md` - TCP/NDJSON message contract
- `message-flow.md` - startup, forward mutation flow, and reverse event flow

### `node/`

Node-side documentation:
- `react-reconciler-integration.md` - how React commits are translated into renderer mutations
- `runtime-model.md` - Node-side in-memory renderer state

### `python/`

Python-side documentation:
- `textual-integration.md` - how the Textual app owns the live UI tree
- `runtime-model.md` - Python-side mirror state and widget registry

## Code layout note

Runtime code lives under `node/src/` and `python/src/`. Paths in these docs refer to those folders.

## Suggested Reading Order

If you are new to the project:

1. `architecture/architecture.md`
2. `architecture/protocol.md`
3. `architecture/message-flow.md`
4. `node/react-reconciler-integration.md`
5. `python/textual-integration.md`

If you are debugging a specific runtime:

- Node questions: start in `node/`
- Python/Textual questions: start in `python/`
- transport or IPC questions: start in `architecture/`

## Why Not A Flat Folder

A flat structure becomes harder to scan once architecture, protocol, and per-runtime docs all live in the same place.

## Why Not More Nesting

More nesting would add paths and categories without adding much clarity.

Right now, `architecture/`, `node/`, and `python/` is enough.
