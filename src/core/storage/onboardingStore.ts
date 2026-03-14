/**
 * Onboarding state for first-time users.
 * Persisted in localStorage. Cleared when app storage is reset.
 */

import { getLS, setLS } from "./localStorage";

const ONBOARDING_KEY = "kt_onboarding";

export type OnboardingStatus = "pending" | "completed" | "skipped";

export interface OnboardingState {
  status: OnboardingStatus;
}

function getDefaultState(): OnboardingState {
  return { status: "pending" };
}

export function getOnboardingState(): OnboardingState {
  return getLS(ONBOARDING_KEY, getDefaultState());
}

export function hasCompletedOnboarding(): boolean {
  const state = getOnboardingState();
  return state.status === "completed";
}

export function hasSkippedOnboarding(): boolean {
  const state = getOnboardingState();
  return state.status === "skipped";
}

/** True if user has not completed or skipped onboarding (first launch or after reset) */
export function isFirstLaunch(): boolean {
  const state = getOnboardingState();
  return state.status === "pending";
}

export function markOnboardingCompleted(): void {
  setLS(ONBOARDING_KEY, { status: "completed" });
}

export function markOnboardingSkipped(): void {
  setLS(ONBOARDING_KEY, { status: "skipped" });
}
