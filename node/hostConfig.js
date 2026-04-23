import React from "react";
import {
  createInstance as createRendererInstance,
  appendChild as appendRendererChild,
  appendChildToRendererState as appendRendererChildToState,
  removeChild as removeRendererChild,
  updateProps as updateRendererProps,
  insertChildBefore as insertRendererChildBefore,
  insertChildBeforeInRendererState as insertRendererChildBeforeInState,
} from "./renderer.js";

import {
  DefaultEventPriority,
  DiscreteEventPriority,
  NoEventPriority,
} from "react-reconciler/constants.js";

const HostTransitionContext =
  /** @type {import("react-reconciler").ReactContext<null>} */ (
    /** @type {unknown} */ (React.createContext(null))
  );

let currentUpdatePriority = NoEventPriority;

export function createHostConfig(rendererState, flushAfterCommit) {
  return {
    // STUBS
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,
    noTimeout: -1,
    supportsMicrotasks: true,

    prepareForCommit() {
      return null;
    },

    preparePortalMount() {
      return null;
    },

    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    scheduleMicrotask: queueMicrotask,

    clearContainer() {},

    getCurrentEventPriority() {
      return DefaultEventPriority;
    },

    getInstanceFromNode() {
      return null;
    },

    prepareScopeUpdate() {},

    getInstanceFromScope() {
      return null;
    },

    beforeActiveInstanceBlur() {},

    afterActiveInstanceBlur() {},

    detachDeletedInstance() {},

    NotPendingTransition: null,
    HostTransitionContext,

    setCurrentUpdatePriority(newPriority) {
      currentUpdatePriority = newPriority;
    },
    getCurrentUpdatePriority() {
      return currentUpdatePriority;
    },
    resolveUpdatePriority() {
      return currentUpdatePriority || DiscreteEventPriority;
    },

    resetFormInstance() {},

    requestPostPaintCallback(callback) {
      setTimeout(() => callback(Date.now()), 0);
    },

    shouldAttemptEagerTransition() {
      return false;
    },

    trackSchedulerEvent() {},

    resolveEventType() {
      return null;
    },

    resolveEventTimeStamp() {
      return Date.now();
    },

    maySuspendCommit() {
      return false;
    },

    preloadInstance() {
      return true;
    },

    startSuspendingCommit() {},

    suspendInstance() {},

    waitForCommitToBeReady() {
      return null;
    },

    // REALIZED
    supportsMutation: true,

    getRootHostContext() {
      return {};
    },
    
    getChildHostContext() {
      return {};
    },

    shouldSetTextContent() {
      return false;
    },

    createInstance(type, props) {
      return createRendererInstance(type, props, rendererState);
    },

    createTextInstance(text) {
      return createRendererInstance("text", { text }, rendererState);
    },

    appendInitialChild(parent, child) {
      appendRendererChild(parent, child, rendererState);
    },

    appendChild(parent, child) {
      appendRendererChild(parent, child, rendererState);
    },

    appendChildToContainer(_container, child) {
      appendRendererChildToState(rendererState, child);
    },

    removeChild(parent, child) {
      removeRendererChild(parent, child, rendererState);
    },

    removeChildFromContainer(_container, child) {
      const rootInstance = rendererState.instanceMap.get(child.parentId);
      if (rootInstance) {
        removeRendererChild(rootInstance, child, rendererState);
      }
    },

    prepareUpdate(_instance, _type, _oldProps, newProps) {
      return newProps;
    },

    commitUpdate(instance, _type, _oldProps, newProps) {
      updateRendererProps(instance, newProps, rendererState);
    },

    commitTextUpdate(textInstance, _oldText, newText) {
      updateRendererProps(
        textInstance,
        { ...textInstance.props, text: newText },
        rendererState
      );
    },

    finalizeInitialChildren() {
      return false;
    },

    resetAfterCommit() {
      flushAfterCommit();
    },

    getPublicInstance(instance) {
      return instance;
    },

    insertBefore(parent, child, beforeChild) {
      insertRendererChildBefore(parent, child, beforeChild, rendererState);
    },

    insertInContainerBefore(_container, child, beforeChild) {
      insertRendererChildBeforeInState(rendererState, child, beforeChild);
    },
  };
}