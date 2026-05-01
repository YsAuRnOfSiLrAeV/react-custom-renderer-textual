import asyncio

from textual.widgets import Button, Input, Static
from runtime import runtime_state
from textual.events import Resize
from textual.app import App, ComposeResult
from textual.containers import Container


class RendererApp(App):
    BINDINGS = [
        ("q", "quit", "Quit"),
    ]

    def compose(self) -> ComposeResult:
        self.renderer_root = Container()
        yield self.renderer_root

    def on_mount(self) -> None:
        runtime_state.mount_child = self.mount_child
        runtime_state.update_widget_props = self.update_widget_props
        runtime_state.unmount_child = self.unmount_child
        runtime_state.insert_before = self.insert_before
        self._viewport_emit_task = None
        asyncio.create_task(self._emit_viewport_payload())

        if runtime_state.ui_ready is not None:
            runtime_state.ui_ready.set()


    def mount_child(self, parent_id: str, child_id: str) -> None:
        # Mounting is deferred during initial tree build because child links may arrive
        # before their parent is mounted in Textual. Once a subtree is attached to the
        # protocol root, we materialize it recursively. Later dynamic appends can be
        # mounted directly if the target parent widget is already mounted.
        
        if parent_id == runtime_state.ROOT_ID:
            self._mount_subtree_into_root(child_id)
            return

        parent_widget = runtime_state.widgets.get(parent_id)
        child_widget = runtime_state.widgets.get(child_id)

        if parent_widget is None or child_widget is None:
            return

        if not parent_widget.is_mounted:
            return

        if child_widget.is_mounted:
            return

        parent_widget.mount(child_widget)
        self._mount_existing_children(child_id)

    def unmount_child(self, _parent_id: str, child_id: str) -> None:
        child_widget = runtime_state.widgets.get(child_id)
        if child_widget is None:
            return
        child_widget.remove()

    def _mount_subtree_into_root(self, node_id: str) -> None:
        widget = runtime_state.widgets.get(node_id)
        if widget is None:
            return

        if widget.is_mounted:
            return

        self.renderer_root.mount(widget)
        self._mount_existing_children(node_id)

    def _mount_existing_children(self, parent_id: str) -> None:
        # Children may already exist in the protocol mirror before their parent is
        # physically mounted in Textual. Once the parent is mounted, walk the stored
        # subtree and mount descendants recursively in parent -> child order.

        parent_widget = runtime_state.widgets.get(parent_id)
        if parent_widget is None:
            return

        child_ids = runtime_state.nodes[parent_id]["childrenIds"]

        for child_id in child_ids:
            child_widget = runtime_state.widgets.get(child_id)
            if child_widget is None:
                continue

            if child_widget.is_mounted:
                continue

            parent_widget.mount(child_widget)
            self._mount_existing_children(child_id)

    async def emit_event(
        self,
        event_name: str,
        target_id: str,
        payload: dict | None = None,
    ) -> None:
        if runtime_state.outgoing_queue is None:
            return

        await runtime_state.outgoing_queue.put({
            "type": "event",
            "eventName": event_name,
            "targetId": target_id,
            "payload": payload or {},
        })

    async def _emit_viewport_payload(self) -> None:
        if runtime_state.outgoing_queue is None:
            return
        size = self.screen.size
        await self.emit_event(
            "viewport",
            runtime_state.ROOT_ID,
            {"w": size.width, "h": size.height},
        )

    async def on_resize(self, event: Resize) -> None:
        _ = event
        previous_emit_task = getattr(self, "_viewport_emit_task", None)
        if previous_emit_task is not None and not previous_emit_task.done():
            previous_emit_task.cancel()
        self._viewport_emit_task = asyncio.create_task(
            self._debounced_emit_viewport()
        )

    async def _debounced_emit_viewport(self) -> None:
        try:
            await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            return
        await self._emit_viewport_payload()

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        renderer_id = getattr(event.button, "_renderer_id", None)
        if renderer_id is None:
            return

        await self.emit_event("press", renderer_id, {})

    async def on_input_changed(self, event: Input.Changed) -> None:
        renderer_id = getattr(event.input, "_renderer_id", None)
        if renderer_id is None:
            return
        await self.emit_event("change", renderer_id, {"value": event.value})

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        renderer_id = getattr(event.input, "_renderer_id", None)
        if renderer_id is None:
            return
        await self.emit_event("submit", renderer_id, {"value": event.value})

    def update_widget_props(self, node_id: str, props: dict) -> None:
        widget = runtime_state.widgets.get(node_id)
        if widget is None:
            return

        element_type = runtime_state.nodes[node_id]["elementType"]

        if element_type == "text" and isinstance(widget, Static):
            widget.update(props.get("text", ""))
            return

        if element_type == "button" and isinstance(widget, Button):
            widget.label = props.get("label", "")
            return

        if element_type == "container":
            return

        if element_type == "input" and isinstance(widget, Input):
            next_value = props.get("value")
            if isinstance(next_value, str) and widget.value != next_value:
                widget.value = next_value

            placeholder = props.get("placeholder")
            if isinstance(placeholder, str):
                widget.placeholder = placeholder
            return

    def insert_before(self, parent_id: str, child_id: str, before_child_id: str) -> None:
        parent_widget = runtime_state.widgets.get(parent_id)
        child_widget = runtime_state.widgets.get(child_id)
        before_child_widget = runtime_state.widgets.get(before_child_id)

        if parent_widget is None or child_widget is None or before_child_widget is None:
            return

        if child_widget.is_mounted:
            child_widget.remove()

        parent_widget.mount(child_widget, before=before_child_widget)
        self._mount_existing_children(child_id)
