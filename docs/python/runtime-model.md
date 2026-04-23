# Python Runtime Model

## Purpose

This document describes the in-memory runtime model used on the Python side of the renderer.

It focuses on:
- what data the Python process stores;
- how incoming operations are applied to the local mirror;
- how the mirror is connected to live Textual widgets;
- why Python stores a runtime mirror instead of being the source of truth.

## Python Side Runtime Model

The Python process is not the source of truth for the renderer tree.

Instead, it stores a runtime mirror of the structure received from Node.

It is responsible for:
- validating incoming protocol messages;
- applying mutation operations to local runtime state;
- owning the live Textual widget tree;
- turning Textual user input into outbound event messages.

## Runtime State

Current runtime state is shared through `python/runtime_state.py`.

Important fields include:

```python
ROOT_ID = "root-container"

nodes = {}
widgets = {}

mount_child = None
update_widget_props = None
unmount_child = None
insert_before = None

outgoing_queue = None
ui_ready = None
```

### Fields

`ROOT_ID`  
Stable renderer root id used by both runtimes.

`nodes`  
Python-side mirror of the renderer tree received from Node.

`widgets`  
Lookup table from renderer id to the live Textual widget instance.

`mount_child`, `update_widget_props`, `unmount_child`, `insert_before`  
Callback slots registered by `RendererApp` so the dispatcher can trigger real UI work without owning Textual directly.

`outgoing_queue`  
Async queue used to send event messages from the Textual app to the socket writer task.

`ui_ready`  
Async event used by `main.py` to wait until the Textual runtime is mounted before opening the TCP flow.

## Why `runtime_state.py` Exists

At this stage, `runtime_state.py` acts as a shared rendezvous point between:

- transport code;
- dispatcher code;
- the live Textual app.

That is not necessarily the final architecture, but it is a reasonable MVP choice because it keeps the shared mutable state explicit and easy to inspect.

The alternative would be passing one larger runtime object through more layers before the boundaries have fully stabilized.

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

## Why Python Keeps A Mirror

Python needs its own runtime mirror so it can:

- resolve ids locally;
- apply ordered structural updates;
- reconnect later updates to existing widgets;
- materialize subtrees only when their parents become mountable.

So Python does store runtime state, but it is not the authoritative renderer model.

It is an applied mirror of the Node-side tree plus a registry of the corresponding live widgets.

This is the key trade-off on the Python side: duplicate enough structure to apply UI work safely, but do not pretend Python owns reconciliation.

## Dispatcher vs Textual Runtime

Python is intentionally split into two layers.

`dispatcher.py` is responsible for protocol semantics:
- validate op shape through schemas;
- update `nodes`;
- call runtime callbacks when needed.

`textual_runtime.py` is responsible for Textual semantics:
- create widgets;
- mount into the actual UI tree;
- update widget props;
- unmount widgets;
- reorder mounted children.

This keeps protocol logic separate from UI lifecycle rules.

That split is especially important because a bad protocol op and a bad Textual mount are different classes of bug and should remain easy to isolate.

## Current Runtime Flow

At the moment, Python-side flow looks like this:

1. Python receives a framed JSON message.
2. The message is decoded and parsed.
3. Batch messages are validated with Pydantic schemas.
4. Each operation is dispatched.
5. The local `nodes` mirror is updated.
6. Textual callbacks apply the corresponding widget changes.

## Alternatives Rejected

Two alternatives would have made the system look simpler at first but worse in practice:

- storing only live widgets without a protocol mirror;
- rebuilding the full UI tree from scratch on every update.

Without the mirror, ordered structural updates become harder to reason about.

With full rebuilds, the renderer would throw away too much useful structure and drift further from how React's commit model actually works.

## Current Limitations

- Reliable ACK or apply confirmation is not implemented yet.
- Layout and styling behavior are still minimal.
- Event coverage is still minimal and only covers the tested `press` flow.
