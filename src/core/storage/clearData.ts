export function clearAdaptiveTrainingData(): void {
  localStorage.removeItem("kt_keystats");
}

export function clearAllData(): void {
  ["kt_settings", "kt_practice", "kt_tests", "kt_streak", "kt_keystats", "tf_session_history"].forEach((k) => {
    localStorage.removeItem(k);
  });
}
