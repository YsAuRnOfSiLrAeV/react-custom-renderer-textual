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
  }
}
```

### Important Notes

`rendererId` is internal and is different from user `props.id`.

`props` contains only serializable values that are safe to send to Python.

`eventHandlers` stays only on the Node side and is used for reverse event dispatch.

## Why Node Stores Event Handlers Separately

The Node process cannot send callback functions through the TCP protocol.

Because of that, runtime data is split into:
- `props` for serializable values;
- `eventHandlers` for local callback functions.

This allows the reverse flow to work like this:
1. Python sends an event with `targetId`;
2. Node finds the instance in `instanceMap`;
3. Node reads the callback from `eventHandlers`;
4. Node calls the callback locally.

## Why We Use Id-Based Links

The Node runtime uses:
- `parentId`
- `childrenIds`

instead of direct object references.

This makes the model:
- easier to log;
- free from circular references;
- closer to the protocol shape;
- easier to serialize and inspect.

## Current Limitations

- The runtime is still partially driven by manual test code.
- `react-reconciler` is not yet fully integrated.
- Reliable delivery with ack/apply confirmation is not implemented yet.
- Event handler support is still minimal and normalized only for supported aliases.
