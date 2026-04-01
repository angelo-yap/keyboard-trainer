const { contextBridge, ipcRenderer } = require("electron");

const bridge = {
  ping: () => "pong",
  keyboardLedSetTargetLetter: (payload) =>
    ipcRenderer.invoke("keyboard-led:set-target-letter", payload),
  keyboardLedSetBacklightPreference: (payload) =>
    ipcRenderer.invoke("keyboard-led:set-backlight-preference", payload),
  keyboardLedReset: (payload) => ipcRenderer.invoke("keyboard-led:reset", payload),
  keyboardLedGetState: () => ipcRenderer.invoke("keyboard-led:get-state"),
};

contextBridge.exposeInMainWorld("api", bridge);
contextBridge.exposeInMainWorld("electronAPI", bridge);
