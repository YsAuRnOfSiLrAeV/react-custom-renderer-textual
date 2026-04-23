# Protocol

## Purpose

This document describes the current message protocol used between the Node process and the Python process.

It focuses on:
- how messages are framed;
- what top-level message types exist;
- what operation types currently exist;
- what data shape each operation carries.

## Framing

Messages are sent as newline-delimited JSON.

That means:
- one complete JSON message is serialized;
- `"\n"` is appended to the end;
- the receiver reads until newline and parses one message at a time.

Current framing helpers:
- Node: `sendFramingMessage()` and `createFramingParser()`
- Python: `send_message()` and `reader.readline()`

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

### `ready`

Used by Python to notify Node that the Python runtime is ready.

Shape:

```json
{
  "type": "ready"
}
```

## Operation Types

Operations are sent inside `batch.ops`.

Each operation currently has:

```json
{
  "type": "op",
  "op": "someOperationName"
}
```

### `create`

Creates a node on the Python-side runtime mirror.

Shape:

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

Shape:

```json
{
  "type": "op",
  "op": "appendChild",
  "parentId": "parent-id",
  "childId": "child-id"
}
```

### `updateProps`

Updates the serializable props of an existing node.

Shape:

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

### Props Sanitization

Node does not send `props.children` to Python inside `create` or `updateProps`.

Reason:
- `children` belongs to React's element description on the Node side;
- the cross-process tree structure is already sent explicitly through structural operations;
- sending both would duplicate tree data in two different formats.

Current structural operations responsible for tree shape:
- `create`
- `appendChild`
- `removeChild`

This rule also prevents accidental serialization of React element objects or internal references that should never cross the transport boundary.

### `removeChild`

Removes a parent-child link between two nodes.

Shape:

```json
{
  "type": "op",
  "op": "removeChild",
  "parentId": "parent-id",
  "childId": "child-id"
}
```

## Validation

On the Python side, batch messages and operations are validated with Pydantic schemas before dispatch.

Current schema coverage includes:
- `BatchMessage`
- `CreateOp`
- `AppendChildOp`
- `UpdatePropsOp`
- `RemoveChildOp`
- `EventMessage`

## Current Limitations

- The protocol does not yet implement ack/apply confirmation.
- The protocol does not yet include layout messages.
- The protocol does not yet include full Textual widget lifecycle details.
- Event support is currently minimal and only covers the tested `press` flow.
