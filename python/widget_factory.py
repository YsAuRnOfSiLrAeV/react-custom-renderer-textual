from textual.containers import Container
from textual.widgets import Button, Static
from textual.widget import Widget


def create_widget(element_type: str, props: dict) -> Widget | None:
    if element_type == "root":
        return None

    if element_type == "text":
        return Static(props.get("text", ""))

    if element_type == "button":
        return Button(label=props.get("label", ""))

    if element_type == "container":
        return Container()

    raise ValueError(f"Unsupported element type: {element_type}")