import {
  createCreateOp,
  createAppendChildOp,
  createUpdatePropsOp,
  createRemoveChildOp,
  createInsertBeforeOp,
} from "../protocol/messages.js";

import {
  createYogaNode,
  freeYogaSubtree,
  applyYogaStyle,
  applyYogaLeafSizing,
  yogaReparentAt,
} from "../layout/yogaUtils.js";

export function createRendererState() {
  return {
    rootId: "root-container",
    rootChildrenIds: [],
    instanceMap: new Map(), // rendererId -> host instance lookup
    pendingOps: [], // queued renderer operations to send to Python
    isReady: false, // true after Python runtime sends the ready message
    viewport: { w: 80, h: 24 }, // terminal size in cells, updated by Python viewport events
    rootYogaNode: createYogaNode(),
  };
}

export function createRendererId() {
  return crypto.randomUUID();
}

export function initializeRendererRoot(rendererState) {
  applyYogaStyle(rendererState.rootYogaNode, { flexDirection: "column" });
  rendererState.pendingOps.push(
    createCreateOp(rendererState.rootId, "root", {})
  );
}

export function createInstance(type, props, rendererState) {
  const normalizedType = normalizeElementType(type);

  const yogaNode = createYogaNode();
  applyYogaStyle(yogaNode, props?.style);
  applyYogaLeafSizing(normalizedType, yogaNode, props);

  const instance = {
    rendererId: createRendererId(),
    type: normalizedType,
    props: sanitizeProps(props),
    parentId: null, // use ids instead of object references to avoid circular logs
    childrenIds: [],
    eventHandlers: extractEventHandlers(normalizedType, props),
    yogaNode,
  };

  rendererState.instanceMap.set(instance.rendererId, instance);

  rendererState.pendingOps.push(
    createCreateOp(instance.rendererId, instance.type, instance.props)
  );

  return instance;
}

export function appendChildToRendererState(rendererState, child) {
  rendererState.rootChildrenIds.push(child.rendererId);

  const rootIndex = rendererState.rootChildrenIds.length - 1;
  yogaReparentAt(rendererState.rootYogaNode, child.yogaNode, rootIndex);

  rendererState.pendingOps.push(
    createAppendChildOp(rendererState.rootId, child.rendererId)
  );
}

export function appendChild(parent, child, rendererState) {
  parent.childrenIds.push(child.rendererId);
  child.parentId = parent.rendererId;

  const childIndex = parent.childrenIds.length - 1;
  yogaReparentAt(parent.yogaNode, child.yogaNode, childIndex);

  rendererState.pendingOps.push(
    createAppendChildOp(parent.rendererId, child.rendererId)
  );
}

export function removeChild(parent, child, rendererState) {
  parent.childrenIds = parent.childrenIds.filter(
    (childId) => childId !== child.rendererId
  );
  child.parentId = null;

  try {
    if (parent.yogaNode && child.yogaNode) {
      parent.yogaNode.removeChild(child.yogaNode);
    }
  } catch {}
  freeYogaSubtree(child.yogaNode);
  child.yogaNode = null;
  
  rendererState.pendingOps.push(
    createRemoveChildOp(parent.rendererId, child.rendererId)
  );
}

export function updateProps(instance, nextProps, rendererState) {
  const sanitizedNextProps = sanitizeProps(nextProps);

  instance.props = sanitizedNextProps;
  instance.eventHandlers = extractEventHandlers(instance.type, nextProps);

  applyYogaStyle(instance.yogaNode, nextProps?.style);
  applyYogaLeafSizing(instance.type, instance.yogaNode, nextProps);

  rendererState.pendingOps.push(
    createUpdatePropsOp(instance.rendererId, sanitizedNextProps)
  );
}

export function sanitizeProps(props) {
  const sanitizedProps = {};

  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "function") {
      continue;
    }

    // React passes children inside props, but our transport must not serialize them.
    // Tree structure is sent separately via create/appendChild/removeChild operations.
    if (key === "children") {
      continue;
    }

    sanitizedProps[key] = value;
  }

  return sanitizedProps;
}

export function extractEventHandlers(type, props) {
  if (type === "button") {
    return {
      press: props.onPress ?? props.onClick ?? null,
    };
  }
  if (type === "input") {
    return {
      change: props.onChange ?? props.onChangeText ?? null,
      submit: props.onSubmit ?? null,
    };
  }
  return {};
}

export function normalizeElementType(type) {
  if (type === "textual-container") {
    return "container";
  }
  if (type === "textual-text") {
    return "text";
  }
  if (type === "textual-button") {
    return "button";
  }
  if (type === "textual-input") {
    return "input";
  }
  return type;
}

export function insertChildBefore(parent, child, beforeChild, rendererState) {
  // React may call insertBefore both for a brand-new child and for reordering
  // an existing child. If the child is already linked under this parent, remove
  // the old position first so we can reinsert it at the new index.
  const existingIndex = parent.childrenIds.indexOf(child.rendererId);
  if (existingIndex !== -1) {
    parent.childrenIds.splice(existingIndex, 1);
  }

  const beforeIndex = parent.childrenIds.indexOf(beforeChild.rendererId);
  if (beforeIndex === -1) {
    // If React asks to insert before a child we don't track under this parent,
    // our runtime tree is already out of sync and should fail loudly.
    throw new Error("beforeChild not found in parent.childrenIds");
  }

  parent.childrenIds.splice(beforeIndex, 0, child.rendererId);
  child.parentId = parent.rendererId;

  const childIndex = parent.childrenIds.indexOf(child.rendererId);
  yogaReparentAt(parent.yogaNode, child.yogaNode, childIndex);

  rendererState.pendingOps.push(
    createInsertBeforeOp(
      parent.rendererId,
      child.rendererId,
      beforeChild.rendererId
    )
  );
}

export function insertChildBeforeInRendererState(
  rendererState,
  child,
  beforeChild
) {
  const existingIndex = rendererState.rootChildrenIds.indexOf(child.rendererId);
  if (existingIndex !== -1) {
    rendererState.rootChildrenIds.splice(existingIndex, 1);
  }

  const beforeIndex = rendererState.rootChildrenIds.indexOf(
    beforeChild.rendererId
  );
  if (beforeIndex === -1) {
    throw new Error("beforeChild not found in rendererState.rootChildrenIds");
  }

  rendererState.rootChildrenIds.splice(beforeIndex, 0, child.rendererId);
  child.parentId = rendererState.rootId;

  const childIndex = rendererState.rootChildrenIds.indexOf(child.rendererId);
  yogaReparentAt(rendererState.rootYogaNode, child.yogaNode, childIndex);

  rendererState.pendingOps.push(
    createInsertBeforeOp(
      rendererState.rootId,
      child.rendererId,
      beforeChild.rendererId
    )
  );
}