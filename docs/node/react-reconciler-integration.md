# React Reconciler Integration

## Purpose

This document explains how the Node process integrates React with the custom renderer runtime.

It focuses on:
- where `react-reconciler` is created;
- what the host config does;
- how React work becomes protocol mutations;
- how reverse events re-enter React.

## Entry Point

The main entry point is `node/renderer-runtime.js`.

That file:

1. starts the TCP server;
2. creates a fresh `rendererState` per connection;
3. initializes the renderer root;
4. builds a host config with `createHostConfig(rendererState, flushAfterCommit)`;
5. creates the reconciler instance with `ReactReconciler(hostConfig)`;
6. creates the root container;
7. renders the demo app with `updateContainerSync()`;
8. flushes commit work with `flushSyncWork()`.

In other words, `renderer-runtime.js` is where the React world, the transport world, and the per-connection renderer state are stitched together.

## Why The Reconciler Is Booted At The Connection Boundary

`rendererState` is created inside the TCP connection handler instead of process-global startup.

That is the right choice because the renderer state is not just generic app state. It is a specific session between one Node process and one Python UI client.

Scoping it per connection prevents:

- stale instances surviving across reconnects;
- pending ops leaking from one session into another;
- ready-state bugs caused by shared mutable transport state.

## Host Config Role

`node/hostConfig.js` is the adapter between React reconciliation and the plain runtime helpers in `node/renderer.js`.

React does not know how to create a Textual button or how to send a TCP batch.

Instead, React asks the host config to perform platform operations such as:

- `createInstance`
- `createTextInstance`
- `appendInitialChild`
- `appendChild`
- `appendChildToContainer`
- `insertBefore`
- `insertInContainerBefore`
- `commitUpdate`
- `commitTextUpdate`
- `removeChild`
- `removeChildFromContainer`

The host config delegates those platform operations into the Node runtime model.

## Why The Host Config Stays Thin

The host config could have contained more business logic directly, but that would make it harder to reason about because React-specific API surface and renderer-specific data mutations would be mixed together.

Keeping the host config thin gives a cleaner separation:

- `hostConfig.js` answers React's host contract;
- `renderer.js` owns the renderer's tree and op generation;
- `treeTransport.js` owns delivery.

This keeps the React-facing adapter separate from the renderer state and transport code.

## What The Runtime Helpers Do

`node/renderer.js` owns the actual renderer-side tree bookkeeping.

Its helpers are responsible for:

- generating renderer ids;
- normalizing TSX element types such as `textual-button` into canonical protocol types such as `button`;
- splitting serializable props from local event handlers;
- updating `parentId` and `childrenIds`;
- pushing protocol operations into `rendererState.pendingOps`.

This means React's commit phase updates plain JavaScript data structures first.

The protocol batch is derived from those structures rather than being built ad hoc in the host config.

## Why Ops Are Queued Instead Of Sent Immediately

Sending protocol messages directly from each host config callback would tie React's mutation sequencing to socket timing.

Queueing ops first is better because it:

- preserves the commit as a coherent unit;
- keeps transport failures away from the mutation code path;
- makes future ACK or retry logic possible at the batch level.

## Why `resetAfterCommit()` Matters

The host config calls `flushAfterCommit()` from `resetAfterCommit()`.

That gives the renderer one consistent place to flush all pending operations after a commit finishes.

The actual transport write is performed by `node/treeTransport.js`, which sends the batch only when:

- Python is connected;
- Python has sent `ready`;
- there is at least one pending operation.

## Reverse Events Back Into React

Incoming socket messages are parsed in `renderer-runtime.js`.

For `event` messages, Node:

1. looks up the target instance in `rendererState.instanceMap`;
2. resolves the local callback from `instance.eventHandlers`;
3. invokes the handler;
4. calls `flushSyncWork()`;
5. flushes any newly queued renderer operations.

This is the bridge from Textual user input back into React state updates.

## Why `flushSyncWork()` Is Used After Events

For the current MVP, the renderer wants the event -> state update -> outgoing mutation loop to stay easy to observe.

Forcing the pending React work to flush immediately after the event keeps this prototype deterministic enough to debug.

That does not mean every future update path must stay sync-flushed forever, but it is a good trade-off while the renderer contract is still being proven out.

## TSX Authoring Layer

The demo app currently uses `App.tsx`.

TSX authoring uses custom intrinsic tags such as:

- `textual-container`
- `textual-text`
- `textual-button`

Those tags exist only at the authoring boundary.

Before values enter the protocol, Node normalizes them into canonical runtime types:

- `container`
- `text`
- `button`

This keeps TypeScript authoring concerns separate from transport concerns.

## Why The Renderer State Is Connection-Scoped

`rendererState` is created inside the TCP connection handler.

That means each Python connection gets its own:

- instance map;
- root children list;
- pending operation queue;
- ready flag.

This avoids leaking one client session into another.

## Current Limitations

- The runtime still supports only a small host element set.
- Layout is not computed yet because Yoga is not wired.
- Event coverage is still minimal and centered on the tested `press` path.
- Reliable delivery is not implemented yet.
