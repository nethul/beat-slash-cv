"""
Beat Slash – Native CUDA-Accelerated Hand Tracking Server
==========================================================
High-performance WebSocket server that captures webcam frames via OpenCV,
runs MediaPipe HandLandmarker inference (with GPU delegation when available),
and streams hand landmark data to the Electron game client.

Uses the MediaPipe Tasks API (v1.0+).

Launch:  python hand_tracker_server.py [--port 9734] [--camera 0] [--width 640] [--height 480]
"""

import asyncio
import argparse
import json
import time
import sys
import signal
import os
import urllib.request
import base64
from typing import Optional

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    import websockets
    from websockets.server import serve

# ─── Global State ───────────────────────────────────────────────────────────────

connected_clients: set = set()
latest_result: Optional[dict] = None
server_running = True
capture_fps = 0.0
inference_fps = 0.0

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hand_landmarker.task")


def ensure_model_downloaded():
    """Download the hand landmarker model if not present locally."""
    if os.path.exists(MODEL_PATH):
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        print(f"[INFO] Model found: {MODEL_PATH} ({size_mb:.1f} MB)")
        return True

    print(f"[INFO] Downloading hand landmarker model...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        print(f"[INFO] Model downloaded: {size_mb:.1f} MB")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to download model: {e}")
        return False


def build_hand_result(
    detection_result,
    inference_ms: float,
    frame_width: int,
    frame_height: int,
) -> dict:
    """Convert MediaPipe HandLandmarkerResult to the JSON format expected by the game client."""
    left_hand = None
    right_hand = None

    if detection_result and detection_result.hand_landmarks:
        for i, hand_landmarks in enumerate(detection_result.hand_landmarks):
            # Get handedness
            handedness_label = "Right"
            if detection_result.handedness and i < len(detection_result.handedness):
                handedness_label = detection_result.handedness[i][0].category_name

            landmarks = []
            for lm in hand_landmarks:
                landmarks.append({
                    "x": round(lm.x, 5),
                    "y": round(lm.y, 5),
                    "z": round(lm.z, 5),
                })

            # Key landmarks for saber construction
            wrist = landmarks[0]
            index_mcp = landmarks[5]
            index_tip = landmarks[8]
            middle_mcp = landmarks[9]

            # 3D Depth estimation: hand scale in image frame indicates physical camera distance
            dx = middle_mcp["x"] - wrist["x"]
            dy = middle_mcp["y"] - wrist["y"]
            hand_span = (dx * dx + dy * dy) ** 0.5 or 0.12
            # camera_z: 0.0 at normal distance (~0.13), negative when reaching forward, positive when pulled back
            camera_z = round((0.13 / max(0.04, hand_span)) - 1.0, 4)

            palm_center = {
                "x": round((wrist["x"] + index_mcp["x"] + middle_mcp["x"]) / 3, 5),
                "y": round((wrist["y"] + index_mcp["y"] + middle_mcp["y"]) / 3, 5),
                "z": round((wrist["z"] + index_mcp["z"] + middle_mcp["z"]) / 3, 5) + camera_z,
            }

            hand_data = {
                "detected": True,
                "wrist": {**wrist, "z": round(wrist["z"] + camera_z, 5)},
                "indexTip": {**index_tip, "z": round(index_tip["z"] + camera_z, 5)},
                "indexBase": {**index_mcp, "z": round(index_mcp["z"] + camera_z, 5)},
                "palmCenter": palm_center,
                "cameraZ": camera_z,
                "handSpan": round(hand_span, 4),
                "rawLandmarks": landmarks,
            }

            if handedness_label == "Left":
                left_hand = hand_data
            else:
                right_hand = hand_data

    return {
        "type": "tracking",
        "leftHand": left_hand,
        "rightHand": right_hand,
        "inferenceMs": round(inference_ms, 2),
        "captureFps": round(capture_fps, 1),
        "inferenceFps": round(inference_fps, 1),
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "timestamp": time.time(),
    }


async def capture_and_track(
    camera_index: int,
    width: int,
    height: int,
    target_fps: int,
    detection_confidence: float,
    tracking_confidence: float,
):
    """Main camera capture and inference loop."""
    global latest_result, capture_fps, inference_fps, server_running, connected_clients

    # ─── Open camera with DirectShow backend (lowest latency on Windows) ────────
    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print(f"[WARN] CAP_DSHOW failed, trying default backend for camera {camera_index}")
        cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera {camera_index}")
        server_running = False
        return

    # Configure camera for low latency
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, target_fps)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"[INFO] Camera opened: {actual_w}x{actual_h} @ {actual_fps:.0f}fps")

    # ─── Initialize MediaPipe HandLandmarker (Tasks API) ────────────────────────
    base_options = mp_python.BaseOptions(
        model_asset_path=MODEL_PATH,
        delegate=mp_python.BaseOptions.Delegate.CPU,
    )

    options = mp_vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=detection_confidence,
        min_hand_presence_confidence=detection_confidence,
        min_tracking_confidence=tracking_confidence,
    )

    hand_landmarker = mp_vision.HandLandmarker.create_from_options(options)
    print("[INFO] MediaPipe HandLandmarker initialized (Tasks API)")

    # ─── FPS tracking ───────────────────────────────────────────────────────────
    frame_count = 0
    inference_count = 0
    fps_timer = time.perf_counter()
    min_frame_interval = 1.0 / target_fps
    timestamp_ms = 0

    try:
        while server_running:
            loop_start = time.perf_counter()

            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.001)
                continue

            frame_count += 1
            timestamp_ms += int(min_frame_interval * 1000)

            # Convert BGR → RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Create MediaPipe Image
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

            # Run inference
            t_inf_start = time.perf_counter()
            detection_result = hand_landmarker.detect_for_video(mp_image, timestamp_ms)
            t_inf_end = time.perf_counter()
            inference_ms = (t_inf_end - t_inf_start) * 1000
            inference_count += 1

            # Build result payload
            result = build_hand_result(detection_result, inference_ms, actual_w, actual_h)

            # Downscale frame for PIP camera preview feedback in browser UI
            if connected_clients and frame_count % 2 == 0:
                try:
                    small_preview = cv2.resize(frame, (240, 160))
                    _, preview_buf = cv2.imencode(".jpg", small_preview, [cv2.IMWRITE_JPEG_QUALITY, 55])
                    result["previewFrame"] = base64.b64encode(preview_buf).decode("utf-8")
                except Exception:
                    pass

            latest_result = result

            # Broadcast to all connected clients
            if connected_clients:
                message = json.dumps(result)
                disconnected = set()
                for client in connected_clients.copy():
                    try:
                        await client.send(message)
                    except Exception:
                        disconnected.add(client)
                connected_clients -= disconnected

            # Update FPS counters every second
            elapsed = time.perf_counter() - fps_timer
            if elapsed >= 1.0:
                capture_fps = frame_count / elapsed
                inference_fps = inference_count / elapsed
                frame_count = 0
                inference_count = 0
                fps_timer = time.perf_counter()

            # Immediately yield to asyncio event loop so WebSocket broadcasts without delay
            await asyncio.sleep(0)

    except Exception as e:
        print(f"[ERROR] Capture loop error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        hand_landmarker.close()
        cap.release()
        print("[INFO] Camera released")


async def ws_handler(websocket):
    """Handle WebSocket client connections."""
    global connected_clients
    client_addr = websocket.remote_address
    print(f"[CONNECT] Client connected: {client_addr}")
    connected_clients.add(websocket)

    try:
        await websocket.send(json.dumps({
            "type": "status",
            "status": "connected",
            "message": "Hand tracking server ready",
        }))

        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "serverTime": time.time(),
                        "captureFps": round(capture_fps, 1),
                        "inferenceFps": round(inference_fps, 1),
                    }))
            except json.JSONDecodeError:
                pass

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[DISCONNECT] Client disconnected: {client_addr}")


async def main(args):
    global server_running

    print("=" * 60)
    print("  Beat Slash – CUDA Hand Tracking Server")
    print("=" * 60)
    print(f"  Camera:     #{args.camera}")
    print(f"  Resolution: {args.width}x{args.height}")
    print(f"  Target FPS: {args.fps}")
    print(f"  WS Port:    {args.port}")
    print(f"  Detection:  {args.detection_confidence}")
    print(f"  Tracking:   {args.tracking_confidence}")
    print(f"  MediaPipe:  v{mp.__version__}")
    print("=" * 60)

    # Check CUDA availability
    try:
        cuda_count = cv2.cuda.getCudaEnabledDeviceCount()
        if cuda_count > 0:
            print(f"[INFO] CUDA available: {cuda_count} device(s)")
        else:
            print("[INFO] No CUDA devices found, running on CPU")
    except Exception:
        print("[INFO] OpenCV CUDA module not available, running on CPU")

    # Ensure model is downloaded
    if not ensure_model_downloaded():
        print("[ERROR] Cannot proceed without model file")
        return

    # Start WebSocket server
    print(f"[INFO] Starting WebSocket server on ws://localhost:{args.port}")

    async with serve(ws_handler, "localhost", args.port) as server:
        print(f"[READY] Server listening on ws://localhost:{args.port}")

        capture_task = asyncio.create_task(
            capture_and_track(
                camera_index=args.camera,
                width=args.width,
                height=args.height,
                target_fps=args.fps,
                detection_confidence=args.detection_confidence,
                tracking_confidence=args.tracking_confidence,
            )
        )

        try:
            await capture_task
        except asyncio.CancelledError:
            pass

    print("[INFO] Server shut down")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Beat Slash Hand Tracking Server")
    parser.add_argument("--port", type=int, default=9734, help="WebSocket port (default: 9734)")
    parser.add_argument("--camera", type=int, default=0, help="Camera device index (default: 0)")
    parser.add_argument("--width", type=int, default=640, help="Camera width (default: 640)")
    parser.add_argument("--height", type=int, default=480, help="Camera height (default: 480)")
    parser.add_argument("--fps", type=int, default=60, help="Target FPS (default: 60)")
    parser.add_argument("--detection-confidence", type=float, default=0.5, help="Min detection confidence")
    parser.add_argument("--tracking-confidence", type=float, default=0.5, help="Min tracking confidence")
    args = parser.parse_args()

    def signal_handler(sig, frame):
        global server_running
        print("\n[INFO] Shutting down...")
        server_running = False

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped by user")
