from textual.containers import Container
from textual.widgets import Button, Input, Static
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

    if element_type == "input":
        input_widget = Input()
        input_widget.value = props.get("value", "") or ""
        placeholder = props.get("placeholder")
        if isinstance(placeholder, str):
            input_widget.placeholder = placeholder
        return input_widget

    raise ValueError(f"Unsupported element type: {element_type}")