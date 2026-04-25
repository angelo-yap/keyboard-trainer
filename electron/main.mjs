import { app, BrowserWindow, Menu, ipcMain } from "electron";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import net from "node:net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const isDev = !app.isPackaged;

// ── Python backend (FastAPI + hand tracker) ───────────────────────────────────

let backendProcess = null;

function isPortBound(port) {
  return new Promise((resolve) => {
    const probe = net.createConnection({ port, host: "127.0.0.1" });
    probe.once("connect", () => { probe.destroy(); resolve(true); });
    probe.once("error",   () => resolve(false));
  });
}

async function startBackend() {
  const alreadyRunning = await isPortBound(8000);
  if (alreadyRunning) {
    console.log("[backend] Port 8000 already in use — skipping Python spawn (Docker mode)");
    return;
  }

  const backendDir = path.join(__dirname, "../hand-detection");
  const pythonCmd = process.env.PYTHON_PATH || "python";

  backendProcess = spawn(pythonCmd, ["backend.py"], {
    cwd: backendDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    process.stdout.write(`[backend] ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    process.stderr.write(`[backend] ${data}`);
  });

  backendProcess.on("error", (err) => {
    console.error(`[backend] Failed to start: ${err.message}`);
    console.error(`[backend] Make sure Python is on PATH or set PYTHON_PATH env var.`);
  });

  backendProcess.on("exit", (code, signal) => {
    if (code !== null) console.log(`[backend] Exited with code ${code}`);
    if (signal !== null) console.log(`[backend] Killed by signal ${signal}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (!backendProcess) return;
  backendProcess.kill();
  backendProcess = null;
}
const QMK_VENDOR_ID = 0x3434;
const QMK_RAW_USAGE_PAGE = 0xff60;
const QMK_RAW_USAGE = 0x61;
const QMK_RAW_REPORT_SIZE = 32;

const KC_KEYCHRON_RGB = 0xa8;
const PER_KEY_RGB_SET_TYPE = 0x08;
const PER_KEY_RGB_SET_COLOR = 0x0a;
const LEGACY_CMD_SET_TARGET = 0x01;

const VIA_CMD_CUSTOM_SET_VALUE = 0x07;
const VIA_CMD_CUSTOM_GET_VALUE = 0x08;
const VIA_CHANNEL_RGB_MATRIX = 0x03;
const VIA_RGB_MATRIX_VALUE_BRIGHTNESS = 0x01;
const VIA_RGB_MATRIX_VALUE_EFFECT = 0x02;
const VIA_RGB_MATRIX_VALUE_COLOR = 0x04;
const VIA_EFFECT_BAND_SPIRAL_VAL = 0x03;
const VIA_REPORT_READ_TIMEOUT_MS = 120;
const VIA_EFFECT_PROBE_MAX = 80;
const VIA_EFFECT_COLOR_APPLY_RETRIES = 3;
const MAX_RGB_BYTE = 255;
const KEYBOARD_IDLE_TIMEOUT_MS = 30_000;

const PER_KEY_RGB_TYPE_SOLID = 0x00;
const DEFAULT_HIGHLIGHT_HSV = { h: 0, s: 0, v: 255 };
const DEFAULT_BACKLIGHT_HSV = { h: 0, s: 255, v: 255 };
const KEYCHRON_LED_COUNT = 103;

const KEY_LED_INDICES = {
  // Number row and controls
  "`": 16,
  "1": 17,
  "2": 18,
  "3": 19,
  "4": 20,
  "5": 21,
  "6": 22,
  "7": 23,
  "8": 24,
  "9": 25,
  "0": 26,
  "-": 27,
  "=": 28,
  BACKSPACE: 29,

  // Top letter row
  TAB: 33,
  Q: 34,
  W: 35,
  E: 36,
  R: 37,
  T: 38,
  Y: 39,
  U: 40,
  I: 41,
  O: 42,
  P: 43,
  "[": 44,
  "]": 45,
  "\\": 46,

  // Home row
  CAPSLOCK: 50,
  A: 51,
  S: 52,
  D: 53,
  F: 54,
  G: 55,
  H: 56,
  J: 57,
  K: 58,
  L: 59,
  ";": 60,
  "'": 61,
  ENTER: 62,

  // Bottom row
  SHIFT: [63, 74],
  Z: 64,
  X: 65,
  C: 66,
  V: 67,
  B: 68,
  N: 69,
  M: 70,
  ",": 71,
  ".": 72,
  "/": 73,

  // Space row
  SPACE: 79,
};

const letterState = {
  currentLetter: null,
  updatedAt: null,
};

let cachedPerKeyRgbMode = null;
let lastAppliedBacklightOff = null;
let lastSelectedBacklightHsv = DEFAULT_BACKLIGHT_HSV;
let keyboardIdleTimer = null;

function validateLetter(value) {
  if (typeof value !== "string") {
    return { ok: false, error: "Key must be a string." };
  }

  const normalized = value.trim().toUpperCase();
  if (!(normalized in KEY_LED_INDICES)) {
    return {
      ok: false,
      error:
        "Unsupported key. Supported: A-Z, 0-9, symbols (`-=[]\\;',./), and Backspace/Tab/CapsLock/Enter/Shift/Space.",
    };
  }

  return { ok: true, key: normalized };
}

function validateKeys(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { ok: false, error: "Keys must be a non-empty array." };
  }

  const normalized = [];
  for (const value of values) {
    const result = validateLetter(value);
    if (!result.ok) {
      return result;
    }
    normalized.push(result.key);
  }

  return { ok: true, keys: Array.from(new Set(normalized)) };
}

function parseHexColor(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const match = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;

  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === rn) {
      hue = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      hue = (bn - rn) / delta + 2;
    } else {
      hue = (rn - gn) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return {
    h: Math.round((hue / 360) * 255),
    s: Math.round(saturation * 255),
    v: Math.round(value * 255),
  };
}

function resolveHsvColor(colorCandidate, fallback) {
  const rgb = parseHexColor(colorCandidate);
  if (!rgb) return fallback;
  return rgbToHsv(rgb);
}

function tryLoadNodeHid() {
  try {
    return require("node-hid");
  } catch (_error) {
    return null;
  }
}

function findQmkRawHidPath(HID) {
  const devices = HID.devices();
  const exact = devices.find(
    (device) =>
      device.vendorId === QMK_VENDOR_ID &&
      device.usagePage === QMK_RAW_USAGE_PAGE &&
      device.usage === QMK_RAW_USAGE,
  );

  if (exact?.path) {
    return exact.path;
  }

  const fallback = devices.find((device) => device.vendorId === QMK_VENDOR_ID);
  return fallback?.path || null;
}

function buildLegacySetTargetReport(letter) {
  const report = new Array(QMK_RAW_REPORT_SIZE + 1).fill(0);
  report[1] = LEGACY_CMD_SET_TARGET;
  report[2] = letter.charCodeAt(0);
  return report;
}

function writeRawHidPayload(device, payload) {
  const report = new Array(QMK_RAW_REPORT_SIZE + 1).fill(0);
  for (let i = 0; i < payload.length && i < QMK_RAW_REPORT_SIZE; i += 1) {
    report[1 + i] = payload[i];
  }
  device.write(report);
}

function normalizeReadBuffer(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  if (data.length === QMK_RAW_REPORT_SIZE + 1) {
    return data.slice(1);
  }

  return data.slice(0, QMK_RAW_REPORT_SIZE);
}

function readRawHidPayload(device, timeoutMs = VIA_REPORT_READ_TIMEOUT_MS) {
  try {
    const data = device.readTimeout(timeoutMs);
    return normalizeReadBuffer(data);
  } catch (_error) {
    return [];
  }
}

function viaWriteRead(device, commandId, args = [], responseDataLength = 0) {
  const payload = new Array(QMK_RAW_REPORT_SIZE).fill(0);
  payload[0] = commandId;
  for (let i = 0; i < args.length && i < QMK_RAW_REPORT_SIZE - 1; i += 1) {
    payload[1 + i] = args[i];
  }

  writeRawHidPayload(device, payload);

  if (responseDataLength <= 0) {
    readRawHidPayload(device, 30);
    return [];
  }

  const response = readRawHidPayload(device);
  if (response.length < 2 || response[0] !== commandId) {
    return [];
  }

  return response.slice(3, 3 + responseDataLength);
}

function viaSetRgbMatrixEffect(device, mode) {
  viaWriteRead(device, VIA_CMD_CUSTOM_SET_VALUE, [
    VIA_CHANNEL_RGB_MATRIX,
    VIA_RGB_MATRIX_VALUE_EFFECT,
    mode,
  ]);
}

function viaSetRgbMatrixBrightness(device, brightness) {
  const clamped = Math.max(0, Math.min(MAX_RGB_BYTE, Math.round(brightness)));
  viaWriteRead(device, VIA_CMD_CUSTOM_SET_VALUE, [
    VIA_CHANNEL_RGB_MATRIX,
    VIA_RGB_MATRIX_VALUE_BRIGHTNESS,
    clamped,
  ]);
}

function viaSetRgbMatrixColor(device, hue, saturation) {
  const h = Math.max(0, Math.min(MAX_RGB_BYTE, Math.round(hue)));
  const s = Math.max(0, Math.min(MAX_RGB_BYTE, Math.round(saturation)));
  viaWriteRead(device, VIA_CMD_CUSTOM_SET_VALUE, [
    VIA_CHANNEL_RGB_MATRIX,
    VIA_RGB_MATRIX_VALUE_COLOR,
    h,
    s,
  ]);
}

function viaGetRgbMatrixEffect(device) {
  const values = viaWriteRead(
    device,
    VIA_CMD_CUSTOM_GET_VALUE,
    [VIA_CHANNEL_RGB_MATRIX, VIA_RGB_MATRIX_VALUE_EFFECT],
    1,
  );
  return typeof values[0] === "number" ? values[0] : null;
}

function viaGetRgbMatrixColor(device) {
  const values = viaWriteRead(
    device,
    VIA_CMD_CUSTOM_GET_VALUE,
    [VIA_CHANNEL_RGB_MATRIX, VIA_RGB_MATRIX_VALUE_COLOR],
    2,
  );
  if (typeof values[0] !== "number" || typeof values[1] !== "number") {
    return null;
  }

  return { h: values[0], s: values[1] };
}

function clampRgbByte(value) {
  return Math.max(0, Math.min(MAX_RGB_BYTE, Math.round(value)));
}

function isMatchingEffectAndColor(device, expectedEffect, expectedHsv) {
  const color = viaGetRgbMatrixColor(device);
  const effectMode = viaGetRgbMatrixEffect(device);
  return (
    effectMode === expectedEffect &&
    Boolean(color) &&
    color.h === expectedHsv.h &&
    color.s === expectedHsv.s
  );
}

function applyRgbMatrixEffectWithColor(device, effect, hsv) {
  const targetHsv = {
    h: clampRgbByte(hsv.h),
    s: clampRgbByte(hsv.s),
  };

  viaSetRgbMatrixBrightness(device, MAX_RGB_BYTE);
  viaSetRgbMatrixEffect(device, effect);

  // Some firmwares reset matrix color when switching effects.
  // Reapply and verify a few times to avoid defaulting to red.
  for (let attempt = 0; attempt < VIA_EFFECT_COLOR_APPLY_RETRIES; attempt += 1) {
    viaSetRgbMatrixColor(device, targetHsv.h, targetHsv.s);
    if (isMatchingEffectAndColor(device, effect, targetHsv)) {
      return;
    }
    viaSetRgbMatrixEffect(device, effect);
  }
}

function detectPerKeyRgbMatrixMode(device) {
  const validModes = [];

  for (let mode = 1; mode <= VIA_EFFECT_PROBE_MAX; mode += 1) {
    viaSetRgbMatrixEffect(device, mode);
    const echoedMode = viaGetRgbMatrixEffect(device);
    if (echoedMode === mode) {
      validModes.push(mode);
    }
  }

  if (validModes.length >= 2) {
    return validModes[validModes.length - 2];
  }

  if (validModes.length === 1) {
    return validModes[0];
  }

  return null;
}

function ensurePerKeyRgbMode(device) {
  if (typeof cachedPerKeyRgbMode === "number") {
    viaSetRgbMatrixEffect(device, cachedPerKeyRgbMode);
    return cachedPerKeyRgbMode;
  }

  const detectedMode = detectPerKeyRgbMatrixMode(device);
  if (typeof detectedMode === "number") {
    cachedPerKeyRgbMode = detectedMode;
    viaSetRgbMatrixEffect(device, detectedMode);
    return detectedMode;
  }

  return null;
}

function buildKeychronReport(subcommand, payload = []) {
  const report = new Array(QMK_RAW_REPORT_SIZE + 1).fill(0);
  report[1] = KC_KEYCHRON_RGB;
  report[2] = subcommand;
  for (let i = 0; i < payload.length && i < QMK_RAW_REPORT_SIZE - 2; i += 1) {
    report[3 + i] = payload[i];
  }
  return report;
}

function sendKeychronRgbCommand(device, subcommand, payload = []) {
  device.write(buildKeychronReport(subcommand, payload));
}

function getLedIndicesForKey(key) {
  const led = KEY_LED_INDICES[key];
  if (Array.isArray(led)) {
    return led;
  }
  if (typeof led === "number") {
    return [led];
  }
  throw new Error(`No matrix mapping for key ${key}.`);
}

function setPerKeyType(device) {
  sendKeychronRgbCommand(device, PER_KEY_RGB_SET_TYPE, [PER_KEY_RGB_TYPE_SOLID]);
}

function applyBacklightPowerState(device, backlightOff) {
  if (lastAppliedBacklightOff === backlightOff) {
    return;
  }

  // Only treat matrix brightness as a power gate for backlight off/on.
  viaSetRgbMatrixBrightness(device, backlightOff ? 0 : 255);
  lastAppliedBacklightOff = backlightOff;
}

function setLedRangeColor(device, start, count, hsv) {
  const payload = [start, count];
  for (let i = 0; i < count; i += 1) {
    payload.push(hsv.h, hsv.s, hsv.v);
  }

  sendKeychronRgbCommand(device, PER_KEY_RGB_SET_COLOR, payload);
}

function fillAllLeds(device, ledCount, hsv) {
  const maxLedsPerPacket = 9;
  for (let start = 0; start < ledCount; start += maxLedsPerPacket) {
    const count = Math.min(maxLedsPerPacket, ledCount - start);
    setLedRangeColor(device, start, count, hsv);
  }
}

function sendKeysToKeychronRgb(device, keys, colors) {
  const forcedMode = ensurePerKeyRgbMode(device);
  applyBacklightPowerState(device, colors.backlightOff);
  setPerKeyType(device);
  fillAllLeds(device, KEYCHRON_LED_COUNT, colors.backlightHsv);

  const allLedIndices = [];
  for (const key of keys) {
    const ledIndices = getLedIndicesForKey(key);
    for (const ledIndex of ledIndices) {
      allLedIndices.push(ledIndex);
    }
  }

  for (const ledIndex of Array.from(new Set(allLedIndices))) {
    setLedRangeColor(device, ledIndex, 1, colors.highlightHsv);
  }
  return { ledIndices: allLedIndices, forcedMode };
}

function resetKeychronRgb(device, colors) {
  const forcedMode = ensurePerKeyRgbMode(device);
  applyBacklightPowerState(device, colors.backlightOff);
  setPerKeyType(device);
  fillAllLeds(device, KEYCHRON_LED_COUNT, colors.backlightHsv);
  return { forcedMode };
}

function sendKeysToKeyboardTransport(keys, colors) {
  const HID = tryLoadNodeHid();
  if (!HID) {
    return {
      delivered: false,
      transport: "rawhid",
      error: "node-hid is not installed. Run npm install node-hid.",
    };
  }

  const devicePath = findQmkRawHidPath(HID);
  if (!devicePath) {
    return {
      delivered: false,
      transport: "rawhid",
      error:
        "QMK Raw HID device not found. Flash a Keychron firmware with KEYCHRON_RGB_ENABLE and RAW_ENABLE.",
    };
  }

  let device;
  try {
    device = new HID.HID(devicePath);
    try {
      const keychronResult = sendKeysToKeychronRgb(device, keys, colors);
      return {
        delivered: true,
        transport: "rawhid-keychron-rgb",
        path: devicePath,
        ledIndex: keychronResult.ledIndices[0],
        forcedMode: keychronResult.forcedMode,
      };
    } catch (_rgbError) {
      if (keys.length === 1 && keys[0].length === 1) {
        device.write(buildLegacySetTargetReport(keys[0]));
      } else {
        throw new Error("Legacy firmware transport only supports single-character keys.");
      }
      return {
        delivered: true,
        transport: "rawhid-legacy-letter",
        path: devicePath,
      };
    }
  } catch (error) {
    return {
      delivered: false,
      transport: "rawhid",
      error: error?.message || "Failed to write Raw HID report.",
    };
  } finally {
    try {
      device?.close();
    } catch (_error) {
      // Ignore close errors because the handle may already be invalid.
    }
  }
}

function resetKeyboardTransport(colors) {
  const HID = tryLoadNodeHid();
  if (!HID) {
    return {
      delivered: false,
      transport: "rawhid",
      error: "node-hid is not installed. Run npm install node-hid.",
    };
  }

  const devicePath = findQmkRawHidPath(HID);
  if (!devicePath) {
    return {
      delivered: false,
      transport: "rawhid",
      error:
        "QMK Raw HID device not found. Flash a Keychron firmware with KEYCHRON_RGB_ENABLE and RAW_ENABLE.",
    };
  }

  let device;
  try {
    device = new HID.HID(devicePath);
    try {
      const keychronResult = resetKeychronRgb(device, colors);
      return {
        delivered: true,
        transport: "rawhid-keychron-rgb",
        path: devicePath,
        forcedMode: keychronResult.forcedMode,
      };
    } catch (_rgbError) {
      return {
        delivered: false,
        transport: "rawhid-legacy-letter",
        path: devicePath,
        error: "Legacy firmware transport does not support reset.",
      };
    }
  } catch (error) {
    return {
      delivered: false,
      transport: "rawhid",
      error: error?.message || "Failed to write Raw HID report.",
    };
  } finally {
    try {
      device?.close();
    } catch (_error) {
      // Ignore close errors because the handle may already be invalid.
    }
  }
}

function applyKeyboardExitLighting() {
  const HID = tryLoadNodeHid();
  if (!HID) return;

  const devicePath = findQmkRawHidPath(HID);
  if (!devicePath) return;

  let device;
  try {
    device = new HID.HID(devicePath);
    applyRgbMatrixEffectWithColor(device, VIA_EFFECT_BAND_SPIRAL_VAL, lastSelectedBacklightHsv);
  } catch (_error) {
    // Ignore shutdown lighting errors to avoid blocking app exit.
  } finally {
    try {
      device?.close();
    } catch (_error) {
      // Ignore close errors.
    }
  }
}

function resetKeyboardIdleTimer() {
  if (keyboardIdleTimer) {
    clearTimeout(keyboardIdleTimer);
  }

  keyboardIdleTimer = setTimeout(() => {
    applyKeyboardExitLighting();
  }, KEYBOARD_IDLE_TIMEOUT_MS);
}

ipcMain.handle("keyboard-led:set-target-letter", (_event, payload) => {
  resetKeyboardIdleTimer();
  const keysResult = validateKeys(payload?.keys);
  const result = keysResult.ok ? keysResult : validateLetter(payload?.letter);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      state: { ...letterState },
    };
  }

  const targetKeys = keysResult.ok ? keysResult.keys : [result.key];

  letterState.currentLetter = targetKeys.join("+");
  letterState.updatedAt = new Date().toISOString();
  const backlightOff = Boolean(payload?.backlightOff);
  const litKeyOff = backlightOff || Boolean(payload?.litKeyOff);
  const backlightBaseHsv = resolveHsvColor(payload?.backlightColor, DEFAULT_BACKLIGHT_HSV);
  lastSelectedBacklightHsv = backlightBaseHsv;
  const litBaseHsv = resolveHsvColor(payload?.litKeyColor, DEFAULT_HIGHLIGHT_HSV);
  const colors = {
    backlightOff,
    litKeyOff,
    backlightHsv: backlightBaseHsv,
    // In per-key solid mode firmware scales output by global matrix brightness.
    // Keeping per-key HSV intact and controlling off through matrix brightness
    // matches keyboard-native behavior.
    highlightHsv: litKeyOff ? backlightBaseHsv : litBaseHsv,
  };
  const transport = sendKeysToKeyboardTransport(targetKeys, colors);

  if (!transport.delivered) {
    return {
      ok: false,
      error: transport.error || "Failed to send Keychron RGB command.",
      state: { ...letterState },
      transport,
    };
  }

  return {
    ok: true,
    state: { ...letterState },
    transport,
  };
});

ipcMain.handle("keyboard-led:get-state", () => ({
  ok: true,
  state: { ...letterState },
}));

ipcMain.handle("keyboard-led:set-backlight-preference", (_event, payload) => {
  const backlightBaseHsv = resolveHsvColor(payload?.backlightColor, DEFAULT_BACKLIGHT_HSV);
  lastSelectedBacklightHsv = backlightBaseHsv;

  return {
    ok: true,
    state: { ...letterState },
  };
});

ipcMain.handle("keyboard-led:reset", (_event, payload) => {
  resetKeyboardIdleTimer();
  const backlightOff = Boolean(payload?.backlightOff);
  const backlightBaseHsv = resolveHsvColor(payload?.backlightColor, DEFAULT_BACKLIGHT_HSV);
  lastSelectedBacklightHsv = backlightBaseHsv;
  const colors = {
    backlightOff,
    litKeyOff: true,
    backlightHsv: backlightBaseHsv,
    highlightHsv: backlightBaseHsv,
  };
  const transport = resetKeyboardTransport(colors);

  if (!transport.delivered) {
    return {
      ok: false,
      error: transport.error || "Failed to reset keyboard lighting.",
      state: { ...letterState },
      transport,
    };
  }

  letterState.currentLetter = null;
  letterState.updatedAt = new Date().toISOString();
  return {
    ok: true,
    state: { ...letterState },
    transport,
  };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: process.platform !== "darwin",
    backgroundColor: "#111",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (process.platform !== "darwin") {
    win.setMenuBarVisibility(false);
    if (typeof win.removeMenu === "function") {
      win.removeMenu();
    }
  }

  if (isDev) {
    win.loadURL("http://localhost:5173");
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: "appMenu" },
        { role: "windowMenu" },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
  await startBackend();
  createWindow();
  resetKeyboardIdleTimer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  stopBackend();
  if (keyboardIdleTimer) {
    clearTimeout(keyboardIdleTimer);
    keyboardIdleTimer = null;
  }
  applyKeyboardExitLighting();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});