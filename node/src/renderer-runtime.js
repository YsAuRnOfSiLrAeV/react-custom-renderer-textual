import net from "node:net";
import React from "react";
import ReactReconciler from "react-reconciler";
import { createFramingParser } from "./transport/framing.js";
import { createRendererState, initializeRendererRoot } from "./runtime/renderer.js";
import { createHostConfig } from "./reconciler/hostConfig.js";
import { flushPendingOps } from "./transport/treeTransport.js";
import { TodoApp } from "./app/App.tsx";
import { recalculateYogaLayout, debugLogYogaLayout } from "./runtime/yogaHost.js";
import { pushLayoutOpsFromYoga } from "./layout/yogaUtils.js";

const PORT = 7261;

const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  console.log("[node] python connected");

  const rendererState = createRendererState();
  initializeRendererRoot(rendererState);

  const flushAfterCommit = () => {
    flushPendingOps(socket, rendererState);
    recalculateYogaLayout(rendererState);
    pushLayoutOpsFromYoga(rendererState);
    flushPendingOps(socket, rendererState);
  };

  const hostConfig = createHostConfig(rendererState, flushAfterCommit);
  const reconciler = ReactReconciler(hostConfig);

  const root = reconciler.createContainer(
    rendererState,
    0,
    null,
    false,
    null,
    "",
    console.error,
    console.error,
    console.error,
    () => {}
  );

  reconciler.updateContainerSync(
    React.createElement(TodoApp),
    root,
    null,
    null
  );
  reconciler.flushSyncWork();

  socket.on(
    "data",
    createFramingParser((message) => {
      console.log("[node] <-", message);

      if (message.type === "event") {
        if (message.eventName === "viewport") {
          const w = message.payload?.w;
          const h = message.payload?.h;
          if (typeof w === "number" && typeof h === "number") {
            rendererState.viewport = { w, h };
            recalculateYogaLayout(rendererState);
            pushLayoutOpsFromYoga(rendererState);
            flushPendingOps(socket, rendererState);
          }
          return;
        }
      
        const targetInstance = rendererState.instanceMap.get(message.targetId);
        const handler = targetInstance?.eventHandlers?.[message.eventName];
        if (typeof handler === "function") {
          handler(message.payload);
        }
        reconciler.flushSyncWork();
        flushPendingOps(socket, rendererState);
        return;
      }

      if (message.type === "ready") {
        rendererState.isReady = true;
        flushPendingOps(socket, rendererState);
      }
    })
  );

  socket.on("close", () => {
    console.log("[node] python disconnected");
  });

  socket.on("error", (error) => {
    console.error("[node] socket error:", error.message);
  });
});

server.on("error", (error) => {
  console.error("[node] server error:", error.message);
});

server.listen(PORT, () => {
  console.log(`[node] listening on port ${PORT}`);
});