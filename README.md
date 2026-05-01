# react-textual-renderer

Custom React renderer that targets a Python Textual UI through TCP-based JSON IPC.

## What Works

- Node runs React and `react-reconciler`
- Python runs Textual
- UI mutations go from Node to Python as NDJSON over TCP
- button events go back from Python to Node

Current host elements:
- `container`
- `text`
- `button`

## Run

Node, from `node/`:

```bash
npm install
npm start
```

Python, from `python/`:

```bash
python -m venv .venv
.\.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
cd src
python main.py
```

## Docs

- `docs/architecture/` - system boundary, protocol, message flow
- `docs/node/` - React renderer and Node runtime
- `docs/python/` - Textual runtime and Python mirror
