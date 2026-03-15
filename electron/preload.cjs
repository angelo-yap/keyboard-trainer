const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("keyboardTrainer", {
	setTargetLetter(letter) {
		return ipcRenderer.invoke("keyboard-led:set-target-letter", { letter });
	},
	getLedState() {
		return ipcRenderer.invoke("keyboard-led:get-state");
	},
});
