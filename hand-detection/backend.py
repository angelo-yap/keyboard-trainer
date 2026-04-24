"""
Typing Checker WebSocket Backend
=================================
FastAPI backend that reads typing state from the shared JSON file
written by typing_checker.py and broadcasts changes to all connected
WebSocket clients (your Electron/React frontend).

Requirements:
    pip install fastapi uvicorn

Run:
    python backend.py

WebSocket endpoint:
    ws://localhost:8000/ws

Health check:
    GET http://localhost:8000/health

Current state snapshot:
    GET http://localhost:8000/state
"""

import json
import asyncio
import os
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────

# Must match the path in typing_checker.py
SHARED_STATE_FILE = "typing_state.json"

# How often (seconds) the backend polls the shared file for changes
POLL_INTERVAL = 0.05  # 50ms = 20 checks per second

app = FastAPI(title="Typing Checker WebSocket Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# CONNECTION MANAGER
# Keeps track of all active WebSocket connections so we can
# broadcast to all of them when the state changes.
# ──────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        if not self.active_connections:
            return
        payload = json.dumps(message)
        # Iterate over a copy in case a client disconnects mid-broadcast
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                self.active_connections.remove(connection)


manager = ConnectionManager()


# ──────────────────────────────────────────────────────────────
# SHARED STATE READER
# ──────────────────────────────────────────────────────────────

def read_state() -> dict:
    """
    Read the current typing state from the shared JSON file.
    Returns a default idle state if the file doesn't exist yet.
    """
    if not os.path.exists(SHARED_STATE_FILE):
        return {
            "verdict": "IDLE",
            "wrong_fingers": [],
            "timestamp": time.time(),
        }
    try:
        with open(SHARED_STATE_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {
            "verdict": "IDLE",
            "wrong_fingers": [],
            "timestamp": time.time(),
        }


# ──────────────────────────────────────────────────────────────
# BACKGROUND BROADCASTER
# Runs as a background task on server startup.
# Polls the shared file and broadcasts to all clients on change.
# ──────────────────────────────────────────────────────────────

async def broadcast_loop():
    """
    Background task that watches the shared state file and broadcasts
    to all connected WebSocket clients only when the state changes.
    This implements the Pub/Sub pattern — only broadcast on change.
    """
    last_verdict = None
    last_wrong_fingers = None

    while True:
        state = read_state()
        current_verdict = state.get("verdict", "IDLE")
        current_wrong_fingers = sorted(state.get("wrong_fingers", []))

        # Only broadcast if something changed
        if current_verdict != last_verdict or current_wrong_fingers != last_wrong_fingers:
            last_verdict = current_verdict
            last_wrong_fingers = current_wrong_fingers

            await manager.broadcast({
                "verdict": current_verdict,
                "wrong_fingers": current_wrong_fingers,
                "timestamp": state.get("timestamp", time.time()),
            })

        await asyncio.sleep(POLL_INTERVAL)


@app.on_event("startup")
async def startup_event():
    """Start the background broadcaster when the server starts."""
    asyncio.create_task(broadcast_loop())
    print("✅ Background broadcaster started.")


# ──────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint. Connect from Electron/React with:

        const ws = new WebSocket("ws://localhost:8000/ws")

        ws.onopen = () => console.log("Connected")

        ws.onmessage = (e) => {
            const data = JSON.parse(e.data)
            // data.verdict       -> "GOOD" | "BAD" | "IDLE"
            // data.wrong_fingers -> e.g. ["R_INDEX", "L_PINKY"]
            // data.timestamp     -> Unix timestamp
        }

        ws.onclose = () => console.log("Disconnected")
    """
    await manager.connect(websocket)

    # Send current state immediately on connection
    # so the client doesn't have to wait for the next change
    current_state = read_state()
    await websocket.send_text(json.dumps(current_state))

    try:
        # Keep the connection alive — we don't expect messages
        # from the client but we listen anyway for clean disconnects
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
async def health():
    """Health check — returns server status and current state."""
    return {
        "status": "ok",
        "active_connections": len(manager.active_connections),
        "current_state": read_state(),
    }


@app.get("/state")
async def state():
    """One-shot current state snapshot (non-WebSocket)."""
    return read_state()


# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print("=== Typing Checker WebSocket Backend ===")
    print(f"Watching state file : {SHARED_STATE_FILE}")
    print("WebSocket endpoint  : ws://localhost:8000/ws")
    print("Health check        : http://localhost:8000/health")
    print("State snapshot      : http://localhost:8000/state\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)