export function clearAllData(): void {
  ["kt_settings", "kt_practice", "kt_tests", "kt_streak", "kt_keystats"].forEach((k) => {
    localStorage.removeItem(k);
  });
}
