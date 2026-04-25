import { useState } from "react";
import { loadState, updateState } from "../lib/storage";

export default function Settings() {
  const [st, setSt] = useState(loadState());

  const setSetting = (patch) => {
    const next = updateState((s) => ({
      ...s,
      settings: { ...s.settings, ...patch },
    }));
    setSt(next);
  };

  const wipe = () => {
    localStorage.removeItem("kbdtrainer:v1");
    setSt(loadState());
  };

  return (
    <div className="panel">
      <div className="panelTitle">Settings</div>

      <div className="settingsRow">
        <div>
          <div className="settingsLabel">Sound effects</div>
          <div className="settingsSub">Optional (placeholder)</div>
        </div>
        <button
          className={`btn ${st.settings.sound ? "btnAccent" : ""}`}
          onClick={() => setSetting({ sound: !st.settings.sound })}
        >
          {st.settings.sound ? "On" : "Off"}
        </button>
      </div>

      <div className="settingsRow">
        <div>
          <div className="settingsLabel">Daily goal (minutes)</div>
          <div className="settingsSub">Used later for progress bar</div>
        </div>
        <input
          className="input"
          type="number"
          min={5}
          max={180}
          value={st.settings.goalMin}
          onChange={(e) => setSetting({ goalMin: Number(e.target.value) })}
        />
      </div>

      <div className="settingsDanger">
        <div>
          <div className="settingsLabel">Reset local data</div>
          <div className="settingsSub">Deletes progress, tests, analytics</div>
        </div>
        <button className="btn" onClick={wipe}>
          Reset
        </button>
      </div>
    </div>
  );
}