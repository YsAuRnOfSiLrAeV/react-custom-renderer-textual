# Flow

## Purpose

This document describes the current communication flow between the Node process and the Python process.

It focuses on:
- startup flow;
- forward mutation flow;
- reverse event flow.

## Startup Flow

### 1. Node starts the TCP server

`renderer-runtime.js` starts a server and waits for the Python process to connect.

### 2. Python connects

`main.py` opens a TCP connection to Node.

### 3. Python sends `ready`

After connecting, Python sends:

```json
{
  "type": "ready"
}
```

Node receives this and marks `rendererState.isReady = true`.

## Forward Mutation Flow

### 1. Node builds runtime instances

Node creates runtime instances using helpers such as:
- `initializeRendererRoot()`
- `createInstance()`
- `appendChild()`
- `appendChildToRendererState()`
- `updateProps()`
- `removeChild()`

### 2. Node accumulates operations

Each mutation helper pushes protocol operations into `rendererState.pendingOps`.

### 3. Node flushes pending operations

`flushPendingOps()` sends:

```json
{
  "type": "batch",
  "ops": [ ... ]
}
```

to the Python process.

### 4. Python receives and validates the batch

Python:
1. reads a framed line;
2. parses JSON;
3. validates the batch with Pydantic schemas.

### 5. Python dispatches each operation

The dispatcher routes each operation by `op` type.

Currently implemented:
- `create`
- `appendChild`
- `updateProps`
- `removeChild`

### 6. Python updates the runtime mirror

The Python process updates its local `nodes` map to mirror the received tree and mutations.

## Reverse Event Flow

### 1. Python sends an event

Python can send an event message like:

```json
{
  "type": "event",
  "eventName": "press",
  "targetId": "some-renderer-id",
  "payload": {}
}
```

### 2. Node receives the event

Node parses the event message and extracts `targetId`.

### 3. Node resolves the target instance

Node looks up the instance in:

```js
rendererState.instanceMap
```

### 4. Node resolves the local event handler

Node reads the corresponding callback from:

```js
instance.eventHandlers
```

### 5. Node invokes the callback

At the current prototype stage, the callback can already be called successfully after lookup.

## Current State Of The Flow

The current system already supports:
- Node -> Python runtime creation flow
- Node -> Python parent-child linking
- Node -> Python props updates
- Node -> Python remove-child unlink flow
- Python -> Node event messages
- Node-side target lookup and local callback invocation

## Current Limitations

- The runtime flow is still driven by manual test setup code.
- `react-reconciler` is not yet fully wired into the loop.
- Textual widget mounting is not yet connected to the Python mirror.
- `removeChild` is currently unlink-only, not recursive deletion.
- Reliable ack-based delivery is not yet implemented.
