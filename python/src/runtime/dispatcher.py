from runtime import runtime_state
from runtime.widget_factory import create_widget


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

    elif op_type == "updateProps":
        node_id = op["id"]
        props = op["props"]

        runtime_state.nodes[node_id]["props"] = props

        if runtime_state.update_widget_props is not None:
            runtime_state.update_widget_props(node_id, props)

        print("[py] updated props for:", node_id)

    elif op_type == "removeChild":
        _handle_remove_child(op)

    elif op_type == "insertBefore":
        _handle_insert_before(op)

    elif op_type == "layout":
        node_id = op["id"]
        runtime_state.layouts[node_id] = {
            "x": op["x"],
            "y": op["y"],
            "w": op["w"],
            "h": op["h"],
        }
        return


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
        runtime_state.mount_child(parent_id, child_id)
        
    print("[py] linked child to parent:", child_id, "->", parent_id)


def _handle_remove_child(op: dict) -> None:
    parent_id = op["parentId"]
    child_id = op["childId"]
    runtime_state.nodes[parent_id]["childrenIds"] = [
        existing_child_id
        for existing_child_id in runtime_state.nodes[parent_id]["childrenIds"]
        if existing_child_id != child_id
    ]
    runtime_state.nodes[child_id]["parentId"] = None
    if runtime_state.unmount_child is not None:
        runtime_state.unmount_child(parent_id, child_id)
    _delete_subtree(child_id)
    print("[py] removed child from parent:", child_id, "x", parent_id)


def _delete_subtree(node_id: str) -> None:
    node = runtime_state.nodes.get(node_id)
    if node is None:
        return
    for child_id in list(node["childrenIds"]):
        _delete_subtree(child_id)
    runtime_state.widgets.pop(node_id, None)
    runtime_state.nodes.pop(node_id, None)


def _handle_insert_before(op: dict) -> None:
    parent_id = op["parentId"]
    child_id = op["childId"]
    before_child_id = op["beforeChildId"]

    children_ids = runtime_state.nodes[parent_id]["childrenIds"]

    if child_id in children_ids:
        children_ids.remove(child_id)

    before_index = children_ids.index(before_child_id)
    children_ids.insert(before_index, child_id)

    runtime_state.nodes[child_id]["parentId"] = parent_id

    if runtime_state.insert_before is not None:
        runtime_state.insert_before(parent_id, child_id, before_child_id)

    print("[py] inserted child before sibling:", child_id, "->", before_child_id)


def print_runtime_state() -> None:
    print("[py] nodes:", runtime_state.nodes)