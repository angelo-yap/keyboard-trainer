import type { TrackingFrame } from "./trackingTypes";

export type TrackerCallbacks = {
  onFrame: (frame: TrackingFrame) => void;
  onError?: (err: unknown) => void;
};

export async function startMediapipeTracker(
  videoEl: HTMLVideoElement,
  cb: TrackerCallbacks
): Promise<() => void> {
  // teammate fills: mediapipe init, camera utils, onResults
  // return a stop() cleanup function
  return () => {};
}