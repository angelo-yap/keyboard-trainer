import cv2
import numpy as np


def rescaleFrame(frame, scale=0.75):
    width = int(frame.shape[1] * scale)
    height = int(frame.shape[0] * scale)
    
    dimension = (width, height)
    return cv2.resize(frame, dimension, interpolation=cv2.INTER_AREA)


frame = rescaleFrame(cv2.imread("./keyboard-img.jpg"), 0.25 )
cap = cv2.VideoCapture(0)


while cap.isOpened():
    success, image = cap.read()
    if not success: break

    # --- IMPROVEMENT 1: Increase Contrast ---
    # This helps separate the black keys from the dark wood table
    alpha = 1.5 # Contrast (1.0-3.0)
    beta = 0    # Brightness (0-100)
    adjusted = cv2.convertScaleAbs(image, alpha=alpha, beta=beta)

    # 1. Standard Pre-processing
    gray = cv2.cvtColor(adjusted, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # --- IMPROVEMENT 2: Use an adaptive or lower Canny threshold ---
    # Live webcams often have softer edges than high-res photos
    edges = cv2.Canny(blurred, 30, 100) 

    # 2. Find ALL contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    key_coords = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        
        # --- IMPROVEMENT 3: Loosen the Area Filter ---
        # Depending on how far your camera is, keys might be smaller than 100px
        if 50 < area < 3000: 
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w)/h
            
            # Keys are squares, but from an angle they might be slightly wider
            if 0.5 < aspect_ratio < 2.0:
                key_coords.append((x, y))
                key_coords.append((x + w, y + h))
                cv2.rectangle(image, (x, y), (x + w, y + h), (255, 0, 0), 1)

    # 3. Draw the Master Rectangle
    if len(key_coords) > 10:
        points = np.array(key_coords)
        x_min, y_min = np.min(points, axis=0)
        x_max, y_max = np.max(points, axis=0)
        
        cv2.rectangle(image, (x_min, y_min), (x_max, y_max), (0, 255, 0), 3)
        cv2.putText(image, "Keyboard Tracked", (x_min, y_min - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    cv2.imshow("Live Keyboard Detection", image)
    cv2.imshow("What the AI sees (Edges)", edges) # Debugging window

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
    
    
# # 1. Standard Pre-processing
# gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
# blurred = cv2.GaussianBlur(gray, (5, 5), 0)
# edges = cv2.Canny(blurred, 50, 150)

# # 2. Find ALL contours
# contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# key_coords = []

# for cnt in contours:
#     area = cv2.contourArea(cnt)
    
#     # FILTER: Only keep shapes that are 'Key-Sized'
#     # You may need to adjust these numbers based on your camera height
#     if 100 < area < 2000: 
#         x, y, w, h = cv2.boundingRect(cnt)
        
#         # Check 'Aspect Ratio' (Keys are roughly square, 1:1)
#         aspect_ratio = float(w)/h
#         if 0.7 < aspect_ratio < 1.3:
#             key_coords.append((x, y))
#             key_coords.append((x + w, y + h))
#             # Draw individual keys in blue (for debugging)
#             cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 0, 0), 1)

# # 3. If we found enough keys, draw the "Master Rectangle"
# if len(key_coords) > 10: # Minimum keys to consider it a keyboard
#     # Convert list of points to a numpy array
#     points = np.array(key_coords)
    
#     # Find the bounding box that covers ALL detected keys
#     x_min, y_min = np.min(points, axis=0)
#     x_max, y_max = np.max(points, axis=0)
    
#     # Draw the keyboard boundary in Green
#     cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), (0, 255, 0), 3)
#     cv2.putText(frame, "Keyboard Area Detected", (x_min, y_min - 10), 
#                 cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
#  cv2.imshow('Keyboard', frame)
cap.release()
cv2.destroyAllWindows()