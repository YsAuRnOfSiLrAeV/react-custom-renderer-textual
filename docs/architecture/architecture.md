# Architecture

## Purpose

This document describes the high-level architecture of the project.

It focuses on:
- what each runtime owns;
- why the system is split into Node and Python;
- which boundaries are deliberate MVP choices versus longer-term design.

## System Shape

The project is a custom React renderer that targets a Python Textual UI through TCP-based JSON IPC.

There are two runtimes:

- `node/` runs React, `react-reconciler`, and the renderer runtime
- `python/` runs Textual and applies the resulting UI mutations

The transport between them is newline-delimited JSON over TCP.

## Why The Split Exists

React rendering and reconciliation live naturally on the Node side.

Textual widget creation and UI lifecycle live naturally on the Python side.

Instead of trying to embed one runtime inside the other, the project uses a protocol boundary:

- Node owns the authoritative renderer tree
- Python owns the live Textual widget tree
- the protocol carries structural mutations and user events between them

## Why This Boundary Is Good For The MVP

This boundary is a deliberate trade-off, not an accident.

It gives the project a few concrete benefits early:

- React-specific complexity stays in one place instead of leaking into Python;
- Textual-specific lifecycle rules stay in one place instead of leaking into Node;
- the protocol becomes inspectable and debuggable as plain data;
- each side can be tested and reasoned about with a smaller mental model.

The main cost is that the renderer now has to maintain two representations of the UI:

- the authoritative tree on Node;
- the applied mirror on Python.

That duplication is worth it here because it keeps the React runtime and Textual runtime loosely coupled.

## Node Responsibilities

The Node process is responsible for:

- starting the TCP server;
- creating a connection-scoped `rendererState`;
- running `react-reconciler`;
- translating React commit work into protocol operations;
- storing local event handlers that cannot cross the transport boundary;
- flushing mutation batches to Python.

Important files:

- `node/renderer-runtime.js`
- `node/hostConfig.js`
- `node/renderer.js`
- `node/treeTransport.js`
- `node/messages.js`

## Python Responsibilities

The Python process is responsible for:

- starting the Textual app;
- maintaining a mirror of the renderer tree received from Node;
- creating and registering Textual widgets;
- mounting, reordering, updating, and unmounting widgets;
- converting Textual user input back into protocol events for Node.

Important files:

- `python/main.py`
- `python/connection_loops.py`
- `python/dispatcher.py`
- `python/runtime_state.py`
- `python/textual_runtime.py`
- `python/widget_factory.py`

## Current Runtime Boundary

The current MVP boundary is intentionally simple.

Node sends:

- `create`
- `appendChild`
- `insertBefore`
- `updateProps`
- `removeChild`

Python sends:

- `ready`
- `event`

This keeps the first end-to-end loop focused on correctness before adding layout, styling depth, or reliable delivery.

## Why The Boundary Is Kept Small

Keeping the protocol small is the right choice at this stage.

If layout data, ACK semantics, richer event families, and styling rules were all added at once, debugging would become much harder because every failure could come from multiple layers at the same time.

The current message set isolates the essential loop first:

1. React commits
2. mutations cross the boundary
3. Textual updates
4. user events come back

Once that loop is stable, richer behavior can be layered on top with less ambiguity.

## Source Of Truth vs Mirror

The Node process is the source of truth for the renderer tree.

The Python process stores an applied mirror of that tree so it can:

- resolve ids locally;
- apply ordered structural changes;
- connect nodes to Textual widgets;
- support later updates and events.

This is also the main reason the project remains debuggable across a process boundary: both sides can speak in ids and structural ops instead of opaque framework objects.

## Current File-Level Shape

At a high level, the repository currently looks like this:

- `node/` - renderer runtime and demo React app
- `python/` - Textual runtime and protocol application
- `docs/` - architecture and runtime notes

The runtime code is still relatively flat inside `node/` and `python/`.

One planned next step is to split those folders further into clearer runtime and transport subareas once the behavior is more stable.

## Better Alternatives Considered

A few other documentation groupings were possible:

- one flat `docs/` directory;
- grouping by file type such as `protocol/`, `runtime/`, `events/`;
- grouping by implementation language only.

For this repo, `architecture/`, `node/`, and `python/` is the better balance.

It matches how engineers actually ask questions:

- "How does the whole system work?" -> `architecture/`
- "How does React enter the renderer?" -> `node/`
- "How does Textual apply this?" -> `python/`

That is more navigable than a flat doc list, but still lighter than a full handbook or ADR-heavy setup.

## Current Limitations

- ACK-based reliable delivery is not implemented yet.
- Yoga layout is not wired yet.
- Styling support is still minimal.
- The runtime folder structure is still pre-refactor.
