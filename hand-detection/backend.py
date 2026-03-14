"""
Typing Checker Backend
======================
FastAPI backend that reads typing state from a shared JSON file
written by typing_checker.py and broadcasts changes via SSE to
the Electron frontend.

Requirements:
    pip install fastapi uvicorn

Run:
    python backend.py

SSE endpoint:
    GET http://localhost:8000/stream

Health check:
    GET http://localhost:8000/health
"""

import json
import asyncio
import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────

# Path to the shared state file written by typing_checker.py
# Both files must agree on this path
SHARED_STATE_FILE = "typing_state.json"

# How often (seconds) the backend polls the shared file for changes
POLL_INTERVAL = 0.05  # 50ms = 20 checks per second

app = FastAPI(title="Typing Checker Backend")

# Allow Electron (localhost) to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

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
        # File might be mid-write, return last known good state
        return {
            "verdict": "IDLE",
            "wrong_fingers": [],
            "timestamp": time.time(),
        }


# ──────────────────────────────────────────────────────────────
# SSE EVENT GENERATOR
# ──────────────────────────────────────────────────────────────

async def event_stream():
    """
    Async generator that watches the shared state file and yields
    SSE events only when the verdict or wrong_fingers change.
    This implements the Pub/Sub pattern — only broadcast on change.
    """
    last_verdict = None
    last_wrong_fingers = None

    while True:
        state = read_state()
        current_verdict = state.get("verdict", "IDLE")
        current_wrong_fingers = sorted(state.get("wrong_fingers", []))

        # Only send an event if something changed
        if current_verdict != last_verdict or current_wrong_fingers != last_wrong_fingers:
            last_verdict = current_verdict
            last_wrong_fingers = current_wrong_fingers

            payload = json.dumps({
                "verdict": current_verdict,
                "wrong_fingers": current_wrong_fingers,
                "timestamp": state.get("timestamp", time.time()),
            })

            # SSE format: data: <payload>\n\n
            yield f"data: {payload}\n\n"

        await asyncio.sleep(POLL_INTERVAL)


# ──────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────

@app.get("/stream")
async def stream():
    """
    SSE endpoint. Connect from Electron with:
        const es = new EventSource("http://localhost:8000/stream")
        es.onmessage = (e) => {
            const data = JSON.parse(e.data)
            // data.verdict -> "GOOD" | "BAD" | "IDLE"
            // data.wrong_fingers -> e.g. ["R_INDEX", "L_PINKY"]
        }
    """
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering if proxied
            "Connection": "keep-alive",
        },
    )


@app.get("/health")
async def health():
    """Health check — also returns the current state snapshot."""
    return {
        "status": "ok",
        "current_state": read_state(),
    }


@app.get("/state")
async def state():
    """One-shot current state snapshot (not SSE)."""
    return read_state()


# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print("=== Typing Checker Backend ===")
    print(f"Watching state file: {SHARED_STATE_FILE}")
    print("SSE stream:   http://localhost:8000/stream")
    print("Health check: http://localhost:8000/health")
    print("Current state: http://localhost:8000/state\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
