export type HandSide = "left" | "right";

export type TrackingConfidence = "good" | "ok" | "bad";

export type HandPoseSummary = {
  side: HandSide;
  // normalized coords [0..1] relative to video frame
  palmCenter?: { x: number; y: number };
  // bounding box for simple drift/zone checks
  bbox?: { x: number; y: number; w: number; h: number };
  // optional: per-finger landmarks if you want later
  landmarks?: Array<{ x: number; y: number; z?: number }>;
};

export type TrackingFrame = {
  ts: number; // ms
  confidence: TrackingConfidence;
  hands: HandPoseSummary[];
  // useful flags for coaching
  flags: {
    handsVisible: boolean;
    leftPresent: boolean;
    rightPresent: boolean;
  };
};