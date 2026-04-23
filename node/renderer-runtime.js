import net from "node:net";
import React from "react";
import ReactReconciler from "react-reconciler";
import { createFramingParser } from "./framing.js";
import { createRendererState, initializeRendererRoot } from "./renderer.js";
import { createHostConfig } from "./hostConfig.js";
import { flushPendingOps } from "./treeTransport.js";
import { CounterApp } from "./app.js";

const PORT = 7261;

const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  console.log("[node] python connected");

  const rendererState = createRendererState();
  initializeRendererRoot(rendererState);

  const flushAfterCommit = () => {
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
    React.createElement(CounterApp),
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
        const targetInstance = rendererState.instanceMap.get(message.targetId);
        targetInstance?.eventHandlers?.press?.();
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