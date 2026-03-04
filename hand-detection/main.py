import cv2
import mediapipe as mp
import numpy as np

# 1. Initialize MediaPipe Hands
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

while cap.isOpened():
    success, image = cap.read()
    if not success: break

    # Convert BGR to RGB for MediaPipe
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = hands.process(image_rgb)

    # If hands are detected
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Draw the skeleton for debugging
            mp_draw.draw_landmarks(image, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            
            # Get Index Finger Tip (Landmark #8)
            # Coordinates are normalized (0.0 to 1.0)
            index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
            
            # Convert to pixel coordinates
            h, w, _ = image.shape
            cx, cy = int(index_tip.x * w), int(index_tip.y * h)
            
            # Highlight the tip
            cv2.circle(image, (cx, cy), 10, (255, 0, 255), cv2.FILLED)
            print(f"Finger at: {cx}, {cy}")

    cv2.imshow('Hand Tracking', image)
    if cv2.waitKey(5) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()