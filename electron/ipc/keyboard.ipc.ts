import { ipcMain } from "electron";

export function registerKeyboardIpc() {
  ipcMain.handle("keyboard:lightKeys", async (_e, keys: string[]) => {
    console.log("[keyboard] lightKeys", keys);
  });
  ipcMain.handle("keyboard:clear", async () => {
    console.log("[keyboard] clear");
  });
}