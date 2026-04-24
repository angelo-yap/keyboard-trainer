import type { TrackingFrame } from "../tracking/trackingTypes";
import type { KeyId } from "../keyboard/keyboardTypes";

export type LessonId = string;

export type LessonStep = {
  id: string;
  title: string;
  prompt: string;
  targetKeys?: KeyId[];
  // how strict coaching is in this step
  requireHandsVisible?: boolean;
  requireHomeRowApprox?: boolean;
};

export type LessonDefinition = {
  id: LessonId;
  name: string;
  steps: LessonStep[];
};

export type LessonInputs = {
  tracking: TrackingFrame | null;
  lastKeyPress?: { key: KeyId; ts: number };
};

export type LessonOutput = {
  // UI / feedback
  feedback?: { level: "info" | "warn" | "error"; message: string };
  // highlight/lighting
  highlightKeys?: KeyId[];
  // step control
  advanceStep?: boolean;
};