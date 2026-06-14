import { useEffect } from "react";
import { useGameStore } from "../game/store";

export function useGameLoop(): void {
  useEffect(() => {
    let frameId = 0;
    let previousFrame = performance.now();

    const loop = (frameTime: number) => {
      const deltaSeconds = Math.min(0.25, Math.max(0, (frameTime - previousFrame) / 1000));
      previousFrame = frameTime;
      useGameStore.getState().tick(Date.now(), deltaSeconds);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, []);
}
