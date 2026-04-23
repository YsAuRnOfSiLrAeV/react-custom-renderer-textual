# Protocol

## Purpose

This document describes the current message protocol used between the Node process and the Python process.

It focuses on:
- how messages are framed;
- what top-level message types exist;
- what operation types currently exist;
- why the protocol is intentionally smaller than the final runtime will be.

## Framing

Messages are sent as newline-delimited JSON.

That means:
- one complete JSON message is serialized;
- `"\n"` is appended to the end;
- the receiver reads until newline and parses one message at a time.

Current framing helpers:
- Node: `sendFramingMessage()` and `createFramingParser()`
- Python: `send_message()` and `reader.readline()`

## Why NDJSON Over TCP

For this project, NDJSON over TCP is a practical MVP transport because it is:

- easy to inspect in logs;
- easy to stream incrementally;
- easy to parse on both runtimes without custom binary framing;
- good enough for the current mutation volume.

The downside is that it is not the most compact or highest-throughput encoding.

That trade-off is acceptable right now because debuggability is more valuable than wire efficiency.

## Top-Level Message Types

### `batch`

Used by Node to send a batch of mutation operations to Python.

Shape:

```json
{
  "type": "batch",
  "ops": [ ... ]
}
```

Why `batch` exists:

- React commits often produce multiple related mutations;
- sending them together preserves a cleaner commit boundary;
- batching reduces protocol chatter compared with one TCP message per operation.

### `event`

Used by Python to send a user event back to Node.

Shape:

```json
{
  "type": "event",
  "eventName": "press",
  "targetId": "some-renderer-id",
  "payload": {}
}
```

Why `event` is separate from `batch`:

- reverse flow is semantically different from forward mutations;
- Node needs to route it into local handlers, not apply it as state replication;
- keeping the shape explicit makes the transport easier to reason about.

### `ready`

Used by Python to notify Node that the Textual runtime is ready to receive and apply the first renderer batch.

Shape:

```json
{
  "type": "ready"
}
```

Why `ready` exists:

- Textual must mount its root app first;
- Node may already have queued initial mutations by the time Python connects;
- the ready gate prevents Node from sending the first batch before Python can safely apply it.

## Operation Types

Operations are sent inside `batch.ops`.

Each operation currently has:

```json
{
  "type": "op",
  "op": "someOperationName"
}
```

Why operations are explicit:

- they are easy to validate with Pydantic;
- they mirror the renderer tree semantics directly;
- they avoid coupling Python to React internals or Fiber details.

### `create`

Creates a node on the Python-side runtime mirror.

```json
{
  "type": "op",
  "op": "create",
  "id": "some-renderer-id",
  "elementType": "button",
  "props": {
    "id": "button-1",
    "label": "Increment"
  }
}
```

### `appendChild`

Creates a parent-child link between two nodes.

```json
{
  "type": "op",
  "op": "appendChild",
  "parentId": "parent-id",
  "childId": "child-id"
}
```

### `insertBefore`

Inserts a child before another child under the same parent.

This operation is required for React reconciliation cases where an element is re-inserted or reordered instead of simply appending at the end.

```json
{
  "type": "op",
  "op": "insertBefore",
  "parentId": "parent-id",
  "childId": "child-id",
  "beforeChildId": "before-child-id"
}
```

### `updateProps`

Updates the serializable props of an existing node.

```json
{
  "type": "op",
  "op": "updateProps",
  "id": "some-renderer-id",
  "props": {
    "id": "button-1",
    "label": "Increment updated"
  }
}
```

### `removeChild`

Removes a parent-child link between two nodes.

```json
{
  "type": "op",
  "op": "removeChild",
  "parentId": "parent-id",
  "childId": "child-id"
}
```

## Why The Protocol Uses Structural Ops Instead Of Full Snapshots

This renderer could have sent the full tree every time.

That would be simpler in one narrow sense, but worse overall because Python would need to diff snapshots or fully rebuild more often.

Structural ops are a better fit because they:

- line up with how React commits actually behave;
- preserve ordering information explicitly;
- let Python apply smaller, clearer changes;
- make future ACK or retry logic easier to scope at the batch level.

## Props Sanitization

Node does not send `props.children` to Python inside `create` or `updateProps`.

Reason:
- `children` belongs to React's element description on the Node side;
- the cross-process tree structure is already sent explicitly through structural operations;
- sending both would duplicate tree data in two different formats.

Current structural operations responsible for tree shape:
- `create`
- `appendChild`
- `insertBefore`
- `removeChild`

This also prevents accidental serialization of React element objects or other non-transport-safe values.

## Validation

On the Python side, batch messages and operations are validated with Pydantic schemas before dispatch.

Current schema coverage includes:
- `BatchMessage`
- `CreateOp`
- `AppendChildOp`
- `InsertBeforeOp`
- `UpdatePropsOp`
- `RemoveChildOp`
- `EventMessage`

Why schema validation is worth it:

- the boundary between runtimes is exactly where bad data becomes expensive to debug;
- validation failures are easier to localize than downstream widget or tree corruption;
- the protocol contract becomes explicit instead of being inferred from handler code.

## Current Limitations

- The protocol does not yet implement ACK or apply confirmation.
- The protocol does not yet carry Yoga/layout data.
- The protocol does not yet define a richer event surface beyond the current MVP.
