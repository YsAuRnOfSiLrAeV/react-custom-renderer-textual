# react-textual-renderer

Custom React renderer that targets a Python Textual UI through TCP-based JSON IPC.

## Overview

This project is split into two runtimes:

- `node/` runs React, `react-reconciler`, and the renderer runtime
- `python/` runs the Textual application and applies UI updates

The two sides communicate over newline-delimited JSON (NDJSON) on TCP.

Current MVP behavior:

- Node renders a React tree into renderer operations
- Python receives batched operations and builds a mirrored runtime tree
- Python creates and mounts Textual widgets from those operations
- Textual user events are sent back to Node
- Node updates React state and sends UI updates back to Python

## Architecture

### Node side

- `renderer-runtime.js` starts the TCP server and boots `react-reconciler`
- `hostConfig.js` bridges React reconciliation into renderer mutations
- `renderer.js` stores renderer instances and queues pending operations
- `treeTransport.js` flushes batched ops to Python

### Python side

- `main.py` starts the Textual app and TCP connection loops
- `connection_loops.py` handles inbound and outbound protocol messages
- `dispatcher.py` applies protocol operations to runtime state
- `textual_runtime.py` owns the live Textual widget tree
- `widget_factory.py` maps renderer element types to Textual widgets

## Current Host Elements

The current MVP supports:

- `container`
- `text`
- `button`

## Running the Project

### 1. Start the Node runtime

From `node/`:

```bash
npm install
npm start
```

### 2. Start the Python runtime

From `python/`:

```bash
python -m venv .venv
.\.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python main.py
```

## Current Status

The current implementation already supports a full end-to-end MVP loop:

1. React renders on the Node side
2. Python mounts widgets in Textual
3. Button press events travel back to Node
4. React state updates travel back to Python
5. Textual UI updates live

## Planned Improvements

- better lifecycle coverage for dynamic mount / unmount
- TSX authoring support for React UI files
- more host elements
- reliable delivery / ACK for mutation batches
- styling and later layout support

## Suggested Repository Name

`react-textual-renderer` is the cleanest name.

`custom-renderer-react-textual` is understandable, but less natural and a bit harder to scan.
