# Textual Integration

## Purpose

This document explains how the Python process integrates the protocol runtime with Textual.

It focuses on:
- where the Textual app starts;
- how protocol ops are turned into widget work;
- why dispatcher logic is separate from Textual lifecycle logic;
- how user events travel back to Node.

## Entry Point

The main Python entry point is `python/main.py`.

That file:

1. creates `runtime_state.outgoing_queue`;
2. creates `runtime_state.ui_ready`;
3. starts `RendererApp` with `run_async()`;
4. waits for `RendererApp.on_mount()` to signal readiness;
5. opens the TCP connection to Node;
6. starts `read_loop()` and `write_loop()`;
7. sends `{"type": "ready"}` through the queue.

This startup order matters because Textual must already be mounted before Node is allowed to send the first batch.

## Why Python Waits Before Sending `ready`

This is one of the most important sequencing decisions in the project.

If Python acknowledged readiness too early, Node could push the initial batch before `RendererApp` had registered callbacks and before the root UI container was safely mountable.

Waiting for `on_mount()` makes startup slightly stricter, but removes a whole class of timing bugs.

## Why `RendererApp` Owns The UI

`python/textual_runtime.py` defines `RendererApp`.

`RendererApp` owns the live Textual widget tree because it is the only place that should directly deal with:

- `compose()`;
- `on_mount()`;
- widget mounting rules;
- widget reordering;
- Textual events such as `Button.Pressed`.

The dispatcher should not try to own Textual internals directly.

## Why Textual Ownership Lives In One Class

UI lifecycle code gets harder to reason about when it is spread across transport handlers, state mirrors, and widget factories at the same time.

Keeping ownership in `RendererApp` gives one place to reason about:

- what is mounted;
- what can be mounted next;
- how Textual-specific operations should happen.

That is more maintainable than letting generic protocol code mutate framework objects directly.

## How Dispatcher And Textual Runtime Work Together

The Python runtime is intentionally split into two layers.

### `dispatcher.py`

Responsible for protocol semantics:
- receive validated operations;
- update `runtime_state.nodes`;
- call runtime callbacks when available.

### `textual_runtime.py`

Responsible for Textual semantics:
- create widgets;
- register them in `runtime_state.widgets`;
- mount them into the live UI tree;
- update widget props;
- unmount widgets;
- reorder widgets with `before=...`.

This separation keeps the transport layer clean and keeps Textual-specific behavior localized.

## Why Callback Registration Is Better Than Direct Coupling

The current callback registration through `runtime_state` is not the only possible design, but it is a good MVP trade-off.

It avoids hard-wiring the dispatcher to a specific app instance while still keeping the runtime synchronous enough to follow.

Later, this could evolve into a more explicit runtime object, but for now it keeps the dependency direction simple:

- protocol code does not construct the UI;
- UI code opts into protocol-driven behavior.

## Callback Registration

In `RendererApp.on_mount()`, the app registers its implementations into `runtime_state`:

- `mount_child`
- `update_widget_props`
- `unmount_child`
- `insert_before`

That lets protocol application code call runtime behavior without importing the app instance directly.

## Mounting Strategy

Textual cannot mount a child into a parent that is not itself mounted yet.

Because of that, `RendererApp` uses two strategies.

### 1. Subtree materialization from the protocol root

When a child is attached to `ROOT_ID`, the runtime can treat that as a subtree becoming visible from the mounted root container.

At that moment it:

1. mounts the subtree root into `renderer_root`;
2. walks the already-known descendants in `runtime_state.nodes`;
3. mounts them recursively in parent-first order.

### 2. Dynamic append into an already-mounted parent

If a later `appendChild` targets a parent widget that is already mounted, the child can be mounted directly and then its own descendants can be materialized if needed.

This is the core reason Python keeps both:

- a mirror tree in `runtime_state.nodes`;
- a live widget registry in `runtime_state.widgets`.

That dual structure is not accidental overhead. It is what lets the runtime handle Textual's mount constraints without losing the full protocol tree.

## Prop Updates

`update_widget_props()` applies the latest serialized props to the live widget.

Current MVP behavior includes:
- updating `Static` content for `text`;
- updating `Button.label` for `button`;
- ignoring `container` props for now.

## Ordered Insertion

React sometimes needs ordered re-insertion rather than append-at-end behavior.

That is why Python implements `insert_before(parent_id, child_id, before_child_id)`.

If the child is already mounted, it is removed first and then re-mounted with Textual's `before=...` support.

This is another place where the runtime mirrors React semantics instead of flattening everything into append-only behavior.

## Reverse Events

For the current MVP, `RendererApp.on_button_pressed()` handles button events.

Each created widget stores `_renderer_id`, which allows Python to map a Textual event back to the renderer node id.

`emit_event()` then pushes:

```json
{
  "type": "event",
  "eventName": "press",
  "targetId": "some-renderer-id",
  "payload": {}
}
```

into `runtime_state.outgoing_queue`, and `write_loop()` sends it to Node.

## Why Events Are Emitted Indirectly

Direct socket writes from widget event handlers would make UI responsiveness depend on transport timing and writer availability.

The queue keeps event production and event delivery separate.

## Current Limitations

- Event coverage is still minimal and centered on button presses.
- Layout and styling support are still shallow.
- Reliable delivery is not implemented yet.
