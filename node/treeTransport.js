import { sendFramingMessage } from "./framing.js";
import { createBatchMessage } from "./messages.js";

export function flushPendingOps(socket, rendererState) {
  if (!rendererState.isReady) {
    return;
  }

  if (rendererState.pendingOps.length === 0) {
    return;
  }
  
  sendFramingMessage(socket, createBatchMessage(rendererState.pendingOps));
  rendererState.pendingOps = []; // later: add reliable delivery / ack
}