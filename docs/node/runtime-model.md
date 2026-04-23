# Node Runtime Model

## Purpose

This document describes the in-memory runtime model used on the Node side of the renderer.

It focuses on:
- what data the Node process stores;
- how renderer instances are represented;
- why Node is the source of truth for the renderer tree.

## Node Side Runtime Model

The Node process is the source of truth for the renderer tree.

It is responsible for:
- creating renderer instances;
- storing the current renderer state;
- translating React commit work into protocol operations;
- accumulating outgoing operations in `pendingOps`;
- handling reverse events from Python;
- keeping local event handlers that must not be sent through TCP.

## RendererState

`RendererState` is the root runtime object on the Node side.

Current shape:

```js
{
  rootId: "root-container",
  rootChildrenIds: [],
  instanceMap: new Map(),
  pendingOps: [],
  isReady: false
}
```

### Fields

`rootId`  
Stable internal id for the renderer root.

`rootChildrenIds`  
Ids of root-level instances attached directly to the renderer root.

`instanceMap`  
Lookup table from `rendererId` to host instance.

`pendingOps`  
Queue of outgoing operations that will later be flushed to Python as a batch.

`isReady`  
Flag that becomes `true` after Python sends the `ready` message.

## Why `RendererState` Is Small

The current `RendererState` intentionally carries only session-critical runtime data:

- root bookkeeping;
- instance lookup;
- pending ops;
- readiness state.

That small surface area is useful because it keeps the core renderer model stable while layout, styling, and reliability concerns are still in flux.

It is easier to grow a small state object than to untangle an oversized one later.

## Host Instance Shape

Each renderer element is stored as a host instance.

Current shape:

```js
{
  rendererId: "some-generated-id",
  type: "button",
  props: {
    id: "button-1",
    label: "Increment"
  },
  parentId: "parent-renderer-id-or-null",
  childrenIds: [],
  eventHandlers: {
    press: () => { ... }
  },
  yogaNode: null
}
```

### Important Notes

`rendererId` is internal and is different from user `props.id`.

`props` contains only serializable values that are safe to send to Python.

`eventHandlers` stays only on the Node side and is used for reverse event dispatch.

`yogaNode` is reserved for future layout integration. It is not wired yet.

## Why The Instance Keeps Both `props` And `eventHandlers`

This split exists because the renderer has two different consumers:

- Python needs serialized view data;
- Node needs live callbacks for reverse event dispatch.

If those concerns were mixed into one field, the runtime would either become harder to serialize or harder to use on the way back from Python events.

## How The Tree Is Represented

The Node runtime uses:
- `parentId`
- `childrenIds`

instead of direct object references.

This makes the model:
- easier to log;
- free from circular references;
- closer to the protocol shape;
- easier to serialize and inspect.

This is one of the places where the renderer favors boring data structures over object graphs, because boring data structures survive process boundaries much better.

## Why Event Handlers Stay Local

The transport cannot carry callback functions.

Because of that, runtime data is split into:
- `props` for serializable values;
- `eventHandlers` for local callback functions.

When Python sends an event back:

1. Node resolves the instance by `targetId`;
2. Node reads the callback from `eventHandlers`;
3. Node invokes the handler locally.

## Element Type Normalization

TSX authoring currently uses custom intrinsic tags such as:
- `textual-container`
- `textual-text`
- `textual-button`

Node normalizes those into canonical renderer element types such as:
- `container`
- `text`
- `button`

This keeps authoring ergonomics separate from the runtime and protocol model.

## Alternatives Rejected

Two alternatives were less attractive here:

- storing direct object references between instances;
- letting JSX tag names become protocol element types directly.

The first makes logging and transport reasoning worse because of circular structure.

The second leaks authoring concerns into the protocol and makes it harder to change the TSX surface later without changing the runtime contract.

## Current Limitations

- Reliable delivery with ACK or apply confirmation is not implemented yet.
- Layout is not computed yet because Yoga is not wired.
- Event handler support is still minimal and normalized only for supported aliases.
