import {
  calculateYogaLayout,
  getYogaLayoutBox,
} from "../layout/yogaUtils.js";
  
export function recalculateYogaLayout(rendererState) {
  const w = rendererState.viewport?.w ?? 80;
  const h = rendererState.viewport?.h ?? 24;
  calculateYogaLayout(rendererState.rootYogaNode, w, h);
}

export function debugLogYogaLayout(rendererState) {
  recalculateYogaLayout(rendererState);

  function walk(instanceId, depth, parentX, parentY) {
    const inst = rendererState.instanceMap.get(instanceId);
    if (!inst) return;
    const box = getYogaLayoutBox(inst.yogaNode);
    const gx = parentX + box.x;
    const gy = parentY + box.y;
    console.log(
      `[yoga] ${"  ".repeat(depth)}${inst.type} x=${gx} y=${gy} w=${box.w} h=${box.h}`
    );
    for (const cid of inst.childrenIds ?? []) {
      walk(cid, depth + 1, gx, gy);
    }
  }

  for (const cid of rendererState.rootChildrenIds ?? []) {
    walk(cid, 0, 0, 0);
  }
}