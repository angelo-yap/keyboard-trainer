import json
import asyncio
import os
import time
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ── Try to import the tracker (may fail if opencv/mediapipe not installed) ────
try:
    import typing_checker as _checker
    _tracker_available = True
except ImportError:
    _checker = None  # type: ignore
    _tracker_available = False

SHARED_STATE_FILE = "typing_state.json"
POLL_INTERVAL = 0.05

app = FastAPI(title="Typing Checker Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        payload = json.dumps(message)
        for conn in list(self.active_connections):
            try:
                await conn.send_text(payload)
            except Exception:
                self.active_connections.remove(conn)


manager = ConnectionManager()


# ── State reading (in-memory when tracker is running, file otherwise) ─────────

def read_state() -> dict:
    if _tracker_available:
        return _checker.get_state()
    if not os.path.exists(SHARED_STATE_FILE):
        return {"verdict": "IDLE", "wrong_fingers": [], "timestamp": time.time()}
    try:
        with open(SHARED_STATE_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"verdict": "IDLE", "wrong_fingers": [], "timestamp": time.time()}


# ── Background tasks ──────────────────────────────────────────────────────────

async def broadcast_loop():
    last_verdict = None
    last_wrong: list = []

    while True:
        state = read_state()
        verdict = state.get("verdict", "IDLE")
        wrong = sorted(state.get("wrong_fingers", []))

        if verdict != last_verdict or wrong != last_wrong:
            last_verdict = verdict
            last_wrong = wrong
            await manager.broadcast({
                "verdict": verdict,
                "wrong_fingers": wrong,
                "timestamp": state.get("timestamp", time.time()),
            })

        await asyncio.sleep(POLL_INTERVAL)


@app.on_event("startup")
async def startup_event():
    if _tracker_available:
        t = threading.Thread(
            target=_checker.run,
            kwargs={"headless": True},
            daemon=True,
        )
        t.start()
        print("[OK] Hand tracker started (headless).")
    else:
        print("[WARN] typing_checker not available - falling back to state file.")

    asyncio.create_task(broadcast_loop())
    print("[OK] Broadcast loop started.")


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await websocket.send_text(json.dumps(read_state()))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── MJPEG video stream ────────────────────────────────────────────────────────

@app.get("/video")
async def video_stream():
    async def generate():
        while True:
            frame = _checker.get_latest_frame() if _tracker_available else None
            if frame is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n"
                    + frame
                    + b"\r\n"
                )
                await asyncio.sleep(1 / 30)
            else:
                await asyncio.sleep(0.1)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store"},
    )


# ── Calibration endpoints ─────────────────────────────────────────────────────

@app.post("/calibrate")
async def calibrate(body: dict):
    corners = body.get("corners", [])
    if len(corners) != 4:
        return {"ok": False, "error": "Exactly 4 corners required (TL, TR, BR, BL)"}
    if not _tracker_available:
        return {"ok": False, "error": "Tracker not running"}
    success = _checker.set_calibration_corners(corners)
    return {"ok": success}


@app.post("/calibrate/reset")
async def calibrate_reset():
    if _tracker_available:
        _checker.reset_calibration()
    return {"ok": True}


# ── Info / health ─────────────────────────────────────────────────────────────

@app.get("/info")
async def info():
    return {
        "tracker_available": _tracker_available,
        "calibrated": _checker.is_calibrated() if _tracker_available else False,
        "frame_width": 1280,
        "frame_height": 720,
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "active_connections": len(manager.active_connections),
        "current_state": read_state(),
    }


@app.get("/state")
async def state():
    return read_state()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print("=== Typing Checker Backend ===")
    print("WebSocket : ws://localhost:8000/ws")
    print("Video     : http://localhost:8000/video")
    print("Calibrate : POST http://localhost:8000/calibrate")
    print("Health    : http://localhost:8000/health\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
