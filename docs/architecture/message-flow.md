# Message Flow

## Purpose

This document describes the current communication flow between the Node process and the Python process.

It focuses on:
- startup flow;
- forward mutation flow;
- reverse event flow;
- why the flow is staged the way it is.

## Startup Flow

### 1. Node starts the TCP server

`node/src/renderer-runtime.js` starts a TCP server and prepares a connection-scoped `rendererState`.

### 2. Node creates the React root

When Python connects, Node creates the reconciler container and renders the demo app through `react-reconciler`.

At this point, the reconciler may already produce host instances and queue mutation operations, but they are not flushed yet unless Python is ready.

### 3. Python starts Textual

`python/src/main.py` creates:
- `runtime_state.outgoing_queue`;
- `runtime_state.ui_ready`;
- `RendererApp`.

`RendererApp` owns the live Textual widget tree and registers runtime callbacks in `on_mount()`.

### 4. Python connects to Node

After the Textual app is mounted and `ui_ready` is set, `main.py` opens the TCP connection to Node.

### 5. Python sends `ready`

After connecting, Python sends:

```json
{
  "type": "ready"
}
```

Node receives this and marks `rendererState.isReady = true`.

### 6. Node flushes the queued initial batch

Once the ready gate is open, Node can flush the initial `create` and tree-linking operations to Python.

## Why Startup Is Gated

Without the `ready` gate, Node could send the first batch before Textual had finished mounting its own root app state.

That would make the initial render timing-dependent and fragile.

The extra handshake makes startup slightly more explicit, but much less ambiguous.

## Forward Mutation Flow

### 1. React reconciliation runs on Node

The app renders into the custom renderer through `react-reconciler`.

The host config delegates mutation work to runtime helpers such as:
- `createInstance()`
- `appendChild()`
- `appendChildToRendererState()`
- `insertChildBefore()`
- `updateProps()`
- `removeChild()`

### 2. Node updates its runtime model

Each helper updates the in-memory tree in `rendererState`:
- `instanceMap`
- `rootChildrenIds`
- per-instance `childrenIds`
- per-instance `parentId`

### 3. Node accumulates protocol operations

Each structural or prop mutation pushes an operation into `rendererState.pendingOps`.

Node currently sends:
- `create`
- `appendChild`
- `insertBefore`
- `updateProps`
- `removeChild`

### 4. Node flushes the batch

At the end of the commit, `flushPendingOps()` sends:

```json
{
  "type": "batch",
  "ops": [ ... ]
}
```

to the Python process, but only if:
- there is an active socket;
- Python has already sent `ready`;
- there is at least one pending operation.

### 5. Python receives and validates the batch

Python:
1. reads a framed line from the socket;
2. parses JSON;
3. validates the message with Pydantic;
4. dispatches each validated operation.

### 6. Python updates the runtime mirror

The dispatcher updates the local `nodes` mirror and calls runtime callbacks from `runtime_state` when available.

These callbacks are owned by `RendererApp` and handle the real Textual widget tree.

### 7. Textual applies the UI change

`RendererApp` handles the live widget operations:
- create and register widgets;
- mount children into already-mounted parents;
- materialize an existing subtree when its parent finally becomes mounted;
- update widget props;
- unmount children;
- reorder children with `insert_before`.

This split is important:
- `python/src/runtime/dispatcher.py` applies protocol semantics;
- `python/src/runtime/textual_runtime.py` applies Textual lifecycle semantics.

## Why Forward Flow Is Split Across Layers

It would be possible to let one file both parse protocol ops and manipulate Textual widgets directly.

That would look simpler at first, but it would make the code harder to evolve because protocol logic and UI lifecycle logic fail for different reasons.

The current split isolates those failure modes:

- if the op contract is wrong, the bug belongs near schemas or dispatch;
- if the widget tree is wrong, the bug belongs near Textual runtime code.

## Reverse Event Flow

### 1. A Textual event happens

For the current prototype, `RendererApp.on_button_pressed()` handles button presses.

### 2. Python resolves the renderer target id

The Textual widget stores `_renderer_id`, which lets Python map the widget event back to the renderer node id.

### 3. Python enqueues an outbound message

`emit_event()` pushes an event message into `runtime_state.outgoing_queue`.

This keeps UI event handling decoupled from the socket writer task.

### 4. Python writer loop sends the event

`write_loop()` drains `outgoing_queue` and writes framed JSON back to Node.

### 5. Node receives the event

Node parses the incoming `event` message, finds the target instance in `rendererState.instanceMap`, resolves the local handler from `instance.eventHandlers`, and calls it.

### 6. React schedules the next update

If the handler changes React state, reconciliation runs again, producing another forward mutation batch.

## Why Events Go Through A Queue

Writing directly to the socket from Textual event handlers would couple UI event handling to network timing.

The queue is better because it:

- keeps event producers simple;
- centralizes socket writes in one task;
- makes shutdown and future reliability work easier.

## Current Limitations

- Reliable ACK-based delivery is not implemented yet.
- Layout is still placeholder-level; Yoga is not wired yet.
- Event coverage is still minimal and only covers the tested `press` flow.
