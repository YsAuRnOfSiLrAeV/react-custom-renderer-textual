import asyncio
from collections.abc import Callable
from textual.widget import Widget

ROOT_ID = "root-container"

# Node-side mirror on Python: protocol model
nodes: dict[str, dict] = {}

# Live Textual widgets created for renderer nodes
widgets: dict[str, Widget] = {}

# Textual runtime registers its mount implementation here
mount_child: Callable[[str, str], None] | None = None

# Outbound protocol messages for Node
outgoing_queue: asyncio.Queue[dict] | None = None

# Signals that RendererApp finished on_mount and can accept UI work
ui_ready: asyncio.Event | None = None

# Textual runtime registers its update implementation here
update_widget_props: Callable[[str, dict], None] | None = None