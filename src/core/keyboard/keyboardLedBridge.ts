import { getSettings } from "../storage/settingsStore";
import { getGuidanceKeysForChar, normalizeTargetKeyForGuidance } from "./keyNormalization";

type LedTransport = {
  delivered?: boolean;
  transport?: string;
  path?: string;
  ledIndex?: number;
  forcedMode?: number | null;
  error?: string;
};

export type KeyboardLedResponse = {
  ok: boolean;
  state?: {
    currentLetter?: string | null;
    updatedAt?: string | null;
  };
  transport?: LedTransport;
  error?: string;
};

export type KeyboardLedDebugEvent = {
  key: string;
  timestamp: string;
  response: KeyboardLedResponse;
};

type KeyboardApi = {
  keyboardLedSetTargetLetter?: (payload: {
    letter: string;
    keys?: string[];
    backlightColor?: string;
    litKeyColor?: string;
    backlightOff?: boolean;
    litKeyOff?: boolean;
  }) => Promise<KeyboardLedResponse>;
  keyboardLedSetBacklightPreference?: (payload: {
    backlightColor?: string;
  }) => Promise<KeyboardLedResponse>;
  keyboardLedReset?: (payload?: {
    backlightColor?: string;
    backlightOff?: boolean;
  }) => Promise<KeyboardLedResponse>;
  keyboardLedGetState?: () => Promise<KeyboardLedResponse>;
};

type KeyboardGlobals = {
  api?: KeyboardApi;
  electronAPI?: KeyboardApi;
};

const listeners = new Set<(event: KeyboardLedDebugEvent) => void>();
let lastEvent: KeyboardLedDebugEvent | null = null;
let inFlight = Promise.resolve();

function getApi(): KeyboardApi | null {
  const globals = window as unknown as KeyboardGlobals;
  const maybeApi = globals.api ?? globals.electronAPI;
  if (!maybeApi) return null;
  return maybeApi;
}

function emit(event: KeyboardLedDebugEvent) {
  lastEvent = event;
  listeners.forEach((listener) => listener(event));
}

const ALIAS_TO_CANONICAL_KEY: Record<string, string> = {
  " ": "SPACE",
  SPACEBAR: "SPACE",
  SPACE: "SPACE",
  ENTER: "ENTER",
  RETURN: "ENTER",
  TAB: "TAB",
  CAPSLOCK: "CAPSLOCK",
  CAPS: "CAPSLOCK",
  BACKSPACE: "BACKSPACE",
  SHIFT: "SHIFT",
  SHIFTLEFT: "SHIFT",
  SHIFTRIGHT: "SHIFT",
};

function normalizeKeyTokenFromRaw(rawKey: string): string | null {
  if (!rawKey) return null;

  const normalizedTarget = normalizeTargetKeyForGuidance(rawKey);
  if (normalizedTarget) {
    return normalizedTarget === " " ? "SPACE" : normalizedTarget.toUpperCase();
  }

  const trimmed = rawKey.trim();
  if (trimmed.length === 0 && rawKey === " ") {
    return "SPACE";
  }

  const normalized = trimmed.toUpperCase();
  if (ALIAS_TO_CANONICAL_KEY[normalized]) {
    return ALIAS_TO_CANONICAL_KEY[normalized];
  }

  return null;
}

function normalizeKeyTokenList(rawKeys: string[]): string[] {
  const tokens = rawKeys
    .map((raw) => normalizeKeyTokenFromRaw(raw))
    .filter((token): token is string => Boolean(token));

  return Array.from(new Set(tokens));
}

async function sendKeys(tokens: string[]): Promise<KeyboardLedResponse> {
  const api = getApi();
  if (!api?.keyboardLedSetTargetLetter) {
    return {
      ok: false,
      error: "Electron keyboard LED bridge is unavailable.",
      transport: {
        delivered: false,
        transport: "unavailable",
      },
    };
  }

  try {
    const settings = getSettings();
    const primary = tokens[0];
    if (!primary) {
      return {
        ok: false,
        error: "No valid key to send.",
        transport: {
          delivered: false,
          transport: "renderer-error",
        },
      };
    }

    const response = await api.keyboardLedSetTargetLetter({
      letter: primary,
      keys: tokens,
      backlightColor: settings.keyboardBacklightColor,
      litKeyColor: settings.keyboardLitKeyColor,
      backlightOff: settings.keyboardBacklightOff,
      litKeyOff: settings.keyboardLitKeyOff,
    });
    return response;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send LED command.",
      transport: {
        delivered: false,
        transport: "renderer-error",
      },
    };
  }
}

export function sendKeyboardLedForKey(rawKey: string): Promise<KeyboardLedResponse | null> {
  const guided = getGuidanceKeysForChar(rawKey);
  if (guided.length > 0) {
    return sendKeyboardLedForKeys(guided);
  }
  return sendKeyboardLedForKeys([rawKey]);
}

export function sendKeyboardLedForKeys(rawKeys: string[]): Promise<KeyboardLedResponse | null> {
  const tokens = normalizeKeyTokenList(rawKeys);
  if (tokens.length === 0) {
    return Promise.resolve(null);
  }

  inFlight = inFlight.then(async () => {
    const response = await sendKeys(tokens);
    emit({
      key: tokens.join("+"),
      timestamp: new Date().toISOString(),
      response,
    });
  });

  return inFlight.then(() => (lastEvent ? lastEvent.response : null));
}

export function resetKeyboardLed(): Promise<KeyboardLedResponse> {
  const api = getApi();
  const resetFn = api?.keyboardLedReset;
  if (!resetFn) {
    return Promise.resolve({
      ok: false,
      error: "Electron keyboard LED reset bridge is unavailable.",
      transport: {
        delivered: false,
        transport: "unavailable",
      },
    });
  }

  const settings = getSettings();
  inFlight = inFlight.then(async () => {
    const response = await resetFn({
      backlightColor: settings.keyboardBacklightColor,
      backlightOff: settings.keyboardBacklightOff,
    });
    emit({
      key: "RESET",
      timestamp: new Date().toISOString(),
      response,
    });
  });

  return inFlight.then(() =>
    lastEvent
      ? lastEvent.response
      : {
          ok: false,
          error: "No keyboard LED response received.",
          transport: {
            delivered: false,
            transport: "unknown",
          },
        },
  );
}

export function syncKeyboardBacklightPreference(): Promise<KeyboardLedResponse> {
  const api = getApi();
  const syncFn = api?.keyboardLedSetBacklightPreference;
  if (!syncFn) {
    return Promise.resolve({
      ok: false,
      error: "Electron keyboard LED backlight sync bridge is unavailable.",
      transport: {
        delivered: false,
        transport: "unavailable",
      },
    });
  }

  const settings = getSettings();
  return syncFn({
    backlightColor: settings.keyboardBacklightColor,
  });
}

export function subscribeKeyboardLedDebug(listener: (event: KeyboardLedDebugEvent) => void) {
  listeners.add(listener);
  if (lastEvent) {
    listener(lastEvent);
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getLastKeyboardLedEvent() {
  return lastEvent;
}
