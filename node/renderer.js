import {
  createCreateOp,
  createAppendChildOp,
  createUpdatePropsOp,
  createRemoveChildOp,
} from "./messages.js";

export function createRendererState() {
  return {
    rootId: "root-container",
    rootChildrenIds: [],
    instanceMap: new Map(), // rendererId -> host instance lookup
    pendingOps: [], // queued renderer operations to send to Python
    isReady: false, // true after Python runtime sends the ready message
  };
}

export function createRendererId() {
  return crypto.randomUUID();
}

export function initializeRendererRoot(rendererState) {
  rendererState.pendingOps.push(
    createCreateOp(rendererState.rootId, "root", {})
  );
}

export function createInstance(type, props, rendererState) {
  const instance = {
    rendererId: createRendererId(),
    type,
    props: sanitizeProps(props),
    parentId: null, // use ids instead of object references to avoid circular logs
    childrenIds: [],
    eventHandlers: extractEventHandlers(type, props),
  };

  rendererState.instanceMap.set(instance.rendererId, instance);

  rendererState.pendingOps.push(
    createCreateOp(instance.rendererId, instance.type, instance.props)
  );

  return instance;
}

export function appendChildToRendererState(rendererState, child) {
  rendererState.rootChildrenIds.push(child.rendererId);

  rendererState.pendingOps.push(
    createAppendChildOp(rendererState.rootId, child.rendererId)
  );
}

export function appendChild(parent, child, rendererState) {
  parent.childrenIds.push(child.rendererId);
  child.parentId = parent.rendererId;

  rendererState.pendingOps.push(
    createAppendChildOp(parent.rendererId, child.rendererId)
  );
}

export function removeChild(parent, child, rendererState) {
  parent.childrenIds = parent.childrenIds.filter(
    (childId) => childId !== child.rendererId
  );
  child.parentId = null;
  rendererState.pendingOps.push(
    createRemoveChildOp(parent.rendererId, child.rendererId)
  );
}

export function updateProps(instance, nextProps, rendererState) {
  const sanitizedNextProps = sanitizeProps(nextProps);

  instance.props = sanitizedNextProps;

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
  return {};
}