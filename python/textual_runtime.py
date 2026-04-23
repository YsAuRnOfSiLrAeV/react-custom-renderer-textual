from textual.widgets import Button, Static
import runtime_state

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

        if runtime_state.ui_ready is not None:
            runtime_state.ui_ready.set()

    def mount_child(self, parent_id: str, child_id: str) -> None:
        # During initial tree build, child links may arrive before the parent widget
        # is mounted in Textual. We only start real UI mounting when a subtree is
        # attached to the protocol root, then mount its already-known descendants.
        if parent_id == runtime_state.ROOT_ID:
            self._mount_subtree_into_root(child_id)

    def _mount_subtree_into_root(self, node_id: str) -> None:
        widget = runtime_state.widgets.get(node_id)
        if widget is None:
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

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        renderer_id = getattr(event.button, "_renderer_id", None)
        if renderer_id is None:
            return

        await self.emit_event("press", renderer_id, {})

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
