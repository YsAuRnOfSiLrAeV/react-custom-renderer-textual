import Yoga from "yoga-layout";
import { createLayoutOp } from "../protocol/messages.js";

function isNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export function createYogaNode() {
  return Yoga.Node.create();
}

export function freeYogaSubtree(yogaNode) {
  if (!yogaNode) return;
  try {
    yogaNode.freeRecursive();
  } catch {
    try {
      yogaNode.free?.();
    } catch {}
  }
}

export function applyYogaStyle(yogaNode, style) {
  if (!yogaNode || !style || typeof style !== "object") return;

  if (style.flexDirection === "row") {
    yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  }
  if (style.flexDirection === "column") {
    yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
  }

  if (isNumber(style.flexGrow)) yogaNode.setFlexGrow(style.flexGrow);
  if (isNumber(style.width)) yogaNode.setWidth(style.width);
  if (isNumber(style.height)) yogaNode.setHeight(style.height);
  if (isNumber(style.padding)) yogaNode.setPadding(Yoga.EDGE_ALL, style.padding);
  if (isNumber(style.gap) && typeof yogaNode.setGap === "function") {
    yogaNode.setGap(Yoga.GUTTER_ALL, style.gap);
  }
}

// Rough cell sizes so Yoga does not collapse leaves to 0 without measure callbacks.
export function applyYogaLeafSizing(elementType, yogaNode, props) {
  if (!yogaNode) return;

  if (elementType === "text") {
    const text = String(props?.text ?? "");
    yogaNode.setWidth(Math.max(1, text.length));
    yogaNode.setHeight(1);
    return;
  }

  if (elementType === "button") {
    const label = String(props?.label ?? "");
    yogaNode.setWidth(Math.max(1, label.length + 2));
    yogaNode.setHeight(1);
    return;
  }

  if (elementType === "input") {
    const w = props?.style?.width;
    yogaNode.setWidth(isNumber(w) ? Math.max(1, w) : 24);
    yogaNode.setHeight(1);
  }
}

export function calculateYogaLayout(rootYogaNode, width, height) {
  if (!rootYogaNode) return;
  rootYogaNode.calculateLayout(width, height, Yoga.DIRECTION_LTR);
}

export function getYogaLayoutBox(yogaNode) {
  if (!yogaNode) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  return {
    x: yogaNode.getComputedLeft(),
    y: yogaNode.getComputedTop(),
    w: yogaNode.getComputedWidth(),
    h: yogaNode.getComputedHeight(),
  };
}

export function yogaReparentAt(parentYoga, childYoga, index) {
  if (!parentYoga || !childYoga) return;
  try {
    parentYoga.removeChild(childYoga);
  } catch {}
  const safeIndex = Math.max(0, Math.min(index, parentYoga.getChildCount()));
  parentYoga.insertChild(childYoga, safeIndex);
}

export function pushLayoutOpsFromYoga(rendererState) {
  function walk(instanceId, parentX, parentY) {
    const inst = rendererState.instanceMap.get(instanceId);
    if (!inst) return;
    const box = getYogaLayoutBox(inst.yogaNode);
    const gx = parentX + box.x;
    const gy = parentY + box.y;
    rendererState.pendingOps.push(
      createLayoutOp(inst.rendererId, gx, gy, box.w, box.h)
    );
    for (const childId of inst.childrenIds ?? []) {
      walk(childId, gx, gy);
    }
  }

  for (const rootChildId of rendererState.rootChildrenIds ?? []) {
    walk(rootChildId, 0, 0);
  }
}