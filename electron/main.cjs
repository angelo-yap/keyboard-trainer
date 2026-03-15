const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;
const letterState = {
  currentLetter: null,
  updatedAt: null,
};

function validateLetter(value) {
  if (typeof value !== "string") {
    return { ok: false, error: "Letter must be a string." };
  }

  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalized)) {
    return { ok: false, error: "Only letters A-Z are supported for now." };
  }

  return { ok: true, letter: normalized };
}

function sendLetterToKeyboardTransport(letter) {
  // Step 1 transport is mock-only so we can integrate app-side flow first.
  // In the next step, this function will call HID/raw transport for QMK.
  console.log(`[keyboard-led] target letter -> ${letter}`);
  return { delivered: false, transport: "mock" };
}

ipcMain.handle("keyboard-led:set-target-letter", (_event, payload) => {
  const result = validateLetter(payload?.letter);

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      state: { ...letterState },
    };
  }

  letterState.currentLetter = result.letter;
  letterState.updatedAt = new Date().toISOString();
  const transport = sendLetterToKeyboardTransport(result.letter);

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

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#111",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});