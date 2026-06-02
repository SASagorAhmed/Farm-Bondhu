import { useCallback, useMemo, useRef, useState } from "react";

import type { Canvas } from "fabric";

import { applyObjectChrome } from "./fabricCanvasHelpers";

import { registerFabricCustomProperties } from "./fabricSerialization";



const MAX_HISTORY = 40;

const DEBOUNCE_MS = 350;



export type FabricHistoryApi = {

  canUndo: boolean;

  canRedo: boolean;

  pushSnapshot: () => void;

  undo: () => Promise<void>;

  redo: () => Promise<void>;

  resetFromCanvas: () => void;

  bindCanvas: (canvas: Canvas) => () => void;

  runWithoutHistory: (fn: () => void | Promise<void>) => Promise<void>;

};



export function useFabricHistory(onAfterRestore?: () => void): FabricHistoryApi {

  registerFabricCustomProperties();



  const stackRef = useRef<string[]>([]);

  const idxRef = useRef(0);

  const isRestoringRef = useRef(false);

  const canvasRef = useRef<Canvas | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const [canUndo, setCanUndo] = useState(false);

  const [canRedo, setCanRedo] = useState(false);



  const updateFlags = useCallback(() => {

    setCanUndo(idxRef.current > 0);

    setCanRedo(idxRef.current < stackRef.current.length - 1);

  }, []);



  const pushSnapshot = useCallback(() => {

    const canvas = canvasRef.current;

    if (!canvas || isRestoringRef.current) return;

    const json = JSON.stringify(canvas.toJSON());

    const stack = stackRef.current.slice(0, idxRef.current + 1);

    stack.push(json);

    if (stack.length > MAX_HISTORY) stack.shift();

    stackRef.current = stack;

    idxRef.current = stack.length - 1;

    updateFlags();

    onAfterRestore?.();

  }, [onAfterRestore, updateFlags]);



  const scheduleSnapshot = useCallback(() => {

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {

      debounceRef.current = null;

      pushSnapshot();

    }, DEBOUNCE_MS);

  }, [pushSnapshot]);



  const restoreIndex = useCallback(

    async (index: number) => {

      const canvas = canvasRef.current;

      if (!canvas || index < 0 || index >= stackRef.current.length) return;

      isRestoringRef.current = true;

      try {

        const json = JSON.parse(stackRef.current[index]);

        await canvas.loadFromJSON(json);

        canvas.getObjects().forEach((o) => applyObjectChrome(o));

        canvas.calcOffset();

        canvas.requestRenderAll();

        idxRef.current = index;

        updateFlags();

        onAfterRestore?.();

      } finally {

        isRestoringRef.current = false;

      }

    },

    [onAfterRestore, updateFlags],

  );



  const undo = useCallback(async () => {

    if (idxRef.current <= 0) return;

    await restoreIndex(idxRef.current - 1);

  }, [restoreIndex]);



  const redo = useCallback(async () => {

    if (idxRef.current >= stackRef.current.length - 1) return;

    await restoreIndex(idxRef.current + 1);

  }, [restoreIndex]);



  const resetFromCanvas = useCallback(() => {

    const canvas = canvasRef.current;

    if (!canvas) return;

    stackRef.current = [JSON.stringify(canvas.toJSON())];

    idxRef.current = 0;

    updateFlags();

  }, [updateFlags]);



  const runWithoutHistory = useCallback(async (fn: () => void | Promise<void>) => {

    isRestoringRef.current = true;

    try {

      await fn();

    } finally {

      isRestoringRef.current = false;

    }

  }, []);



  const bindCanvas = useCallback(

    (canvas: Canvas) => {

      canvasRef.current = canvas;

      let binding = true;



      const onAdded = () => {

        if (binding || isRestoringRef.current) return;

        pushSnapshot();

      };

      const onRemoved = () => {

        if (binding || isRestoringRef.current) return;

        pushSnapshot();

      };

      const onModified = () => {

        if (binding || isRestoringRef.current) return;

        scheduleSnapshot();

      };



      canvas.on("object:added", onAdded);

      canvas.on("object:removed", onRemoved);

      canvas.on("object:modified", onModified);



      resetFromCanvas();

      binding = false;



      return () => {

        canvas.off("object:added", onAdded);

        canvas.off("object:removed", onRemoved);

        canvas.off("object:modified", onModified);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        canvasRef.current = null;

      };

    },

    [pushSnapshot, resetFromCanvas, scheduleSnapshot],

  );



  return useMemo(
    () => ({
      canUndo,
      canRedo,
      pushSnapshot,
      undo,
      redo,
      resetFromCanvas,
      bindCanvas,
      runWithoutHistory,
    }),
    [canUndo, canRedo, pushSnapshot, undo, redo, resetFromCanvas, bindCanvas, runWithoutHistory],
  );
}

