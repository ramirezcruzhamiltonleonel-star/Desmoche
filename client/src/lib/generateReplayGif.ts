import { toCanvas } from "html-to-image";
import GIF from "gif.js";

export interface ReplayScene {
  /** How long this scene holds in the final GIF, in milliseconds. */
  holdMs: number;
}

/**
 * Captures one still frame per scene (the caller drives `setScene` and
 * waits for a render in between) and stitches them into an animated GIF —
 * deliberately NOT a real recording of a live CSS animation. Sampling a
 * live animation would need precise frame timing against a DOM that's
 * mid-transition; a handful of deliberate, static "scenes" held for a
 * fixed duration each is far more reliable and still reads as a short,
 * shareable clip once played back.
 */
export async function generateReplayGif(
  container: HTMLElement,
  scenes: ReplayScene[],
  setScene: (index: number) => void,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const gif = new GIF({
    workers: 2,
    quality: 10,
    workerScript: "/gif.worker.js",
    width: container.offsetWidth,
    height: container.offsetHeight,
  });

  for (let i = 0; i < scenes.length; i++) {
    setScene(i);
    // Let React actually paint the new scene before we snapshot it.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await toCanvas(container, { pixelRatio: 1 });
    gif.addFrame(canvas, { delay: scenes[i]!.holdMs, copy: true });
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on("progress", (fraction: number) => onProgress?.(fraction));
    gif.on("finished", (blob: Blob) => resolve(blob));
    gif.on("abort", () => reject(new Error("Se canceló la generación del GIF")));
    gif.render();
  });
}
