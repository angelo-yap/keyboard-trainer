export type KeyId = string; // e.g. "F", "J", "Space", "A"

export type KeyboardLightCommand =
  | { kind: "lightKeys"; keys: KeyId[] }
  | { kind: "clear" };

export interface KeyboardLighting {
  lightKeys(keys: KeyId[]): Promise<void>;
  clear(): Promise<void>;
}