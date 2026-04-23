# Python Runtime Model

## Purpose

This document describes the in-memory runtime model used on the Python side of the renderer.

It focuses on:
- what data the Python process stores;
- how incoming operations are applied to the local mirror;
- why Python stores a runtime mirror instead of the source of truth.

## Python Side Runtime Model

The Python process is not the source of truth for the renderer tree.

Instead, it stores a runtime mirror of the structure received from Node.

It is responsible for:
- validating incoming protocol messages;
- applying mutation operations to local runtime state;
- preparing the structure that will later be connected to Textual widgets.

## Runtime State

Current runtime state:

```python
nodes: dict[str, dict] = {}
```

This is the main lookup table for nodes received from the Node process.

## Python Node Shape

Each created node is stored in `nodes` with this shape:

```python
{
    "id": "some-renderer-id",
    "elementType": "button",
    "props": {
        "id": "button-1",
        "label": "Increment"
    },
    "parentId": "parent-id-or-null",
    "childrenIds": []
}
```

### Important Notes

`id` is the renderer id received from Node.

`elementType` is the host element type received in the `create` operation.

`props` stores the latest serializable props received from Node.

`parentId` and `childrenIds` recreate the tree structure locally on the Python side.

## Why Python Stores Runtime State

Python needs its own runtime mirror so it can:
- reconstruct the received tree structure;
- apply `create`, `appendChild`, `updateProps`, and `removeChild`;
- resolve nodes by id during future updates;
- later bind nodes to actual Textual widgets.

So Python does store runtime state, but it is not the authoritative renderer model.
It is only an applied mirror of the Node-side tree.

## Current Runtime Flow

At the moment, Python-side flow looks like this:

1. Python receives a framed JSON message.
2. The message is decoded and parsed.
3. Batch messages are validated with Pydantic schemas.
4. Each operation is dispatched.
5. The local `nodes` mirror is updated.

## Current Limitations

- Python nodes are not yet connected to actual Textual widgets.
- `removeChild` currently behaves like unlinking, not full recursive deletion.
- The runtime mirror is still used mainly for protocol application and debugging.
- Reverse event flow exists, but full React-driven update cycle is not connected yet.
