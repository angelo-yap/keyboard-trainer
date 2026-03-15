export function getLS<T>(key: string, defaultVal: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : defaultVal;
  } catch {
    return defaultVal;
  }
}

export function setLS<T>(key: string, val: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}
