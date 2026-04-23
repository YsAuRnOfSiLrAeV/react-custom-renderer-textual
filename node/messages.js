export function createCreateOp(id, elementType, props) {
  return {
    type: "op",
    op: "create",
    id,
    elementType,
    props,
  };
}

export function createAppendChildOp(parentId, childId) {
  return {
    type: "op",
    op: "appendChild",
    parentId,
    childId,
  };
}
  
export function createBatchMessage(ops) {
  return {
    type: "batch",
    ops,
  };
}

export function createUpdatePropsOp(id, props) {
  return {
    type: "op",
    op: "updateProps",
    id,
    props,
  };
}

export function createRemoveChildOp(parentId, childId) {
  return {
    type: "op",
    op: "removeChild",
    parentId,
    childId,
  };
}

export function createInsertBeforeOp(parentId, childId, beforeChildId) {
  return {
    type: "op",
    op: "insertBefore",
    parentId,
    childId,
    beforeChildId,
  };
}