import runtime_state
from widget_factory import create_widget


def handle_message(message: dict) -> None:
  if message.get("type") == "batch":
      handle_batch(message)
  else:
      print("[py] <-", message)


def handle_batch(message: dict) -> None:
  print("[py] <- batch")
  for op in message.get("ops", []):
        handle_op(op)


def handle_op(op: dict) -> None:
    op_type = op.get("op")

    if op_type == "create":
        _handle_create(op)

    elif op_type == "appendChild":
        _handle_append_child(op)

    elif op_type == "removeChild":
        parent_id = op["parentId"]
        child_id = op["childId"]
        runtime_state.nodes[parent_id]["childrenIds"] = [
            existing_child_id
            for existing_child_id in runtime_state.nodes[parent_id]["childrenIds"]
            if existing_child_id != child_id
        ]
        runtime_state.nodes[child_id]["parentId"] = None
        print("[py] removed child from parent:", child_id, "x", parent_id)

    elif op_type == "updateProps":
        node_id = op["id"]
        props = op["props"]

        runtime_state.nodes[node_id]["props"] = props

        if runtime_state.update_widget_props is not None:
            runtime_state.update_widget_props(node_id, props)

        print("[py] updated props for:", node_id)


def _handle_create(op: dict) -> None:
    node_id = op["id"]
    element_type = op["elementType"]
    props = op["props"]

    runtime_state.nodes[node_id] = {
        "id": node_id,
        "elementType": element_type,
        "props": props,
        "parentId": None,
        "childrenIds": [],
    }

    widget = create_widget(element_type, props)
    if widget is not None:
        setattr(widget, "_renderer_id", node_id)
        runtime_state.widgets[node_id] = widget

    print("[py] created node:", runtime_state.nodes[node_id])


def _handle_append_child(op: dict) -> None:
    parent_id = op["parentId"]
    child_id = op["childId"]

    runtime_state.nodes[parent_id]["childrenIds"].append(child_id)
    runtime_state.nodes[child_id]["parentId"] = parent_id

    if runtime_state.mount_child is not None:
        print("[py] appendChild wants mount:", child_id, "->", parent_id)
        runtime_state.mount_child(parent_id, child_id)
        
    print("[py] linked child to parent:", child_id, "->", parent_id)



def print_runtime_state() -> None:
    print("[py] nodes:", runtime_state.nodes)