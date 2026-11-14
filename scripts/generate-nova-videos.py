import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import math
import os

WIDTH = 1920
HEIGHT = 1080
FPS = 60

# Fonts
def get_font(name, size):
    try:
        path = os.path.join(r"C:\Windows\Fonts", name)
        return ImageFont.truetype(path, size)
    except:
        return ImageFont.load_default()

font_title = get_font("segoeui.ttf", 46)
font_bold = get_font("segoeui.ttf", 32)
font_regular = get_font("segoeui.ttf", 26)
font_mono = get_font("consola.ttf", 26)
font_mono_small = get_font("consola.ttf", 22)
font_small = get_font("segoeui.ttf", 22)

# Load logo
logo_path = r"client\public\logo.png"
logo_img = None
if os.path.exists(logo_path):
    logo_img = Image.open(logo_path).convert("RGBA")

# -------------------------------------------------------------
# 1. RENDER VIDEO PROJECT 6 (Nova Themed Motion Graphics)
# -------------------------------------------------------------
print("Rendering Nova Video Project 6 (3.5s @ 60fps)...")
out_v6 = cv2.VideoWriter("client/public/videos/video-project-6.mp4", cv2.VideoWriter_fourcc(*'mp4v'), FPS, (WIDTH, HEIGHT))

total_frames_v6 = int(3.5 * FPS) # 210 frames
for f in range(total_frames_v6):
    t = f / FPS
    # Create base dark cosmic image
    img = Image.new("RGBA", (WIDTH, HEIGHT), (7, 4, 18, 255))
    draw = ImageDraw.Draw(img)

    # Ambient glowing background circles
    glow_x = int(WIDTH / 2 + math.sin(t * 2) * 50)
    glow_y = int(HEIGHT / 2 + math.cos(t * 2) * 30)
    # We can draw soft radial gradient or concentric rings
    for r in range(400, 50, -30):
        alpha = int(14 * (1 - r / 400))
        draw.ellipse([glow_x - r, glow_y - r * 0.7, glow_x + r, glow_y + r * 0.7], fill=(139, 92, 246, alpha))

    # Perspective Cyber Grid on floor
    horizon = int(HEIGHT * 0.58)
    for row in range(horizon, HEIGHT, 28):
        depth = (row - horizon) / (HEIGHT - horizon)
        grid_alpha = int(45 * depth)
        draw.line([(0, row), (WIDTH, row)], fill=(168, 85, 247, grid_alpha), width=1)
    
    # Radiating grid lines to horizon
    center_x = WIDTH // 2
    for x in range(0, WIDTH, 90):
        draw.line([(center_x, horizon), (x, HEIGHT)], fill=(139, 92, 246, 25), width=1)

    # Floating Diamond particles
    for p in range(12):
        px = int((p * 170 + t * 40) % WIDTH)
        py = int(horizon - 120 + math.sin(t * 3 + p) * 60)
        p_alpha = int(120 + math.sin(t * 4 + p) * 80)
        draw.polygon([(px, py - 6), (px + 6, py), (px, py + 6), (px - 6, py)], fill=(192, 132, 252, p_alpha))

    # Floating 3D Cards Container
    card_float = math.sin(t * 2.5) * 8

    # --- TOP CARD: USER MESSAGE ---
    c1_w, c1_h = 860, 100
    c1_x = (WIDTH - c1_w) // 2
    c1_y = int(220 + card_float)

    # User Avatar circle
    u_cx, u_cy = c1_x - 70, c1_y + 50
    draw.ellipse([u_cx - 30, u_cy - 30, u_cx + 30, u_cy + 30], fill=(26, 18, 48, 255), outline=(168, 85, 247, 180), width=2)
    draw.text((u_cx - 10, u_cy - 16), "U", font=font_bold, fill=(220, 200, 255, 255))

    # User card body
    draw.rounded_rectangle([c1_x, c1_y, c1_x + c1_w, c1_y + c1_h], radius=24, fill=(18, 11, 35, 230), outline=(139, 92, 246, 120), width=2)
    draw.text((c1_x + 35, c1_y + 30), "How can I implement Nova AI in Next.js?", font=font_bold, fill=(245, 245, 255, 255))

    # --- BOTTOM CARD: NOVA AI RESPONSE ---
    c2_w, c2_h = 860, 360
    c2_x = (WIDTH - c2_w) // 2
    c2_y = int(360 + card_float)

    # Nova Mascot circle
    n_cx, n_cy = c2_x - 70, c2_y + 50
    draw.ellipse([n_cx - 30, n_cy - 30, n_cx + 30, n_cy + 30], fill=(26, 18, 48, 255), outline=(192, 132, 252, 220), width=2)
    if logo_img:
        logo_resized = logo_img.resize((48, 48), Image.Resampling.LANCZOS)
        img.paste(logo_resized, (n_cx - 24, n_cy - 24), logo_resized)

    # Nova card body
    draw.rounded_rectangle([c2_x, c2_y, c2_x + c2_w, c2_y + c2_h], radius=24, fill=(15, 9, 30, 240), outline=(168, 85, 247, 160), width=2)
    
    # Content inside Nova card
    draw.text((c2_x + 35, c2_y + 28), "Steps to implement Nova AI in Next.js", font=font_bold, fill=(230, 220, 255, 255))
    draw.text((c2_x + 35, c2_y + 85), "1. Install the official @nova/ai package with npm:", font=font_regular, fill=(180, 170, 210, 255))

    # Terminal box 1
    t1_y = c2_y + 130
    draw.rounded_rectangle([c2_x + 35, t1_y, c2_x + c2_w - 35, t1_y + 55], radius=12, fill=(24, 15, 48, 255), outline=(139, 92, 246, 80), width=1)
    draw.text((c2_x + 55, t1_y + 14), "$ npm i @nova/ai", font=font_mono, fill=(130, 225, 255, 255))

    # Step 2
    draw.text((c2_x + 35, c2_y + 210), "2. Connect real-time streaming with Gemini 3.5 Flash:", font=font_regular, fill=(180, 170, 210, 255))
    
    # Terminal box 2
    t2_y = c2_y + 255
    draw.rounded_rectangle([c2_x + 35, t2_y, c2_x + c2_w - 35, t2_y + 65], radius=12, fill=(24, 15, 48, 255), outline=(139, 92, 246, 80), width=1)
    draw.text((c2_x + 55, t2_y + 18), "const nova = new Nova({ model: 'gemini-3.5-flash', stream: true });", font=font_mono_small, fill=(192, 132, 252, 255))

    # Convert PIL RGBA to OpenCV BGR
    frame_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGBA2BGR)
    out_v6.write(frame_bgr)

out_v6.release()
print("Finished rendering Nova Video Project 6!")

# -------------------------------------------------------------
# 2. RENDER VIDEO PROJECT 4 (Nova Themed Motion Graphics)
# -------------------------------------------------------------
print("Rendering Nova Video Project 4 (4.0s @ 60fps)...")
out_v4 = cv2.VideoWriter("client/public/videos/video-project-4.mp4", cv2.VideoWriter_fourcc(*'mp4v'), FPS, (WIDTH, HEIGHT))

total_frames_v4 = int(4.0 * FPS) # 240 frames
for f in range(total_frames_v4):
    t = f / FPS
    img = Image.new("RGBA", (WIDTH, HEIGHT), (7, 4, 18, 255))
    draw = ImageDraw.Draw(img)

    # Ambient deep purple space clouds
    for r in range(500, 100, -40):
        alpha = int(12 * (1 - r / 500))
        draw.ellipse([WIDTH // 2 - r, 300 - r * 0.6, WIDTH // 2 + r, 300 + r * 0.6], fill=(168, 85, 247, alpha))
        draw.ellipse([WIDTH // 2 - r + 100, 700 - r * 0.6, WIDTH // 2 + r + 100, 700 + r * 0.6], fill=(99, 102, 241, alpha))

    # Main Headline
    draw.text((WIDTH // 2 - 240, 110), "Nova AI Ecosystem", font=font_title, fill=(255, 255, 255, 255))
    draw.text((WIDTH // 2 - 200, 175), "Next-Generation Autonomous Intelligence", font=font_regular, fill=(192, 132, 252, 220))

    # Search Bar at Top
    sb_w, sb_h = 760, 68
    sb_x = (WIDTH - sb_w) // 2
    sb_y = 240
    draw.rounded_rectangle([sb_x, sb_y, sb_x + sb_w, sb_y + sb_h], radius=34, fill=(18, 12, 35, 240), outline=(168, 85, 247, 140), width=2)
    draw.text((sb_x + 40, sb_y + 18), "Search Nova docs & workspace with AI...", font=font_regular, fill=(170, 160, 200, 255))
    
    # "Ask Nova" pill inside search bar
    pill_w, pill_h = 135, 48
    pill_x = sb_x + sb_w - pill_w - 10
    pill_y = sb_y + 10
    draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=24, fill=(139, 92, 246, 220))
    draw.text((pill_x + 22, pill_y + 10), "Ask Nova", font=font_regular, fill=(255, 255, 255, 255))

    # Cascading 3D Cards Fanning out
    fan_progress = min(1.0, t / 1.5)
    
    cards = [
        {
            "badge": "DOCS",
            "title": "Nova Knowledge & Memory Engine",
            "desc": "Contextual neural retrieval, enterprise vector indexing & deep memory.",
            "color": (20, 14, 38),
            "outline": (139, 92, 246, 120),
            "base_y": 380,
            "offset_y": -40 * fan_progress,
            "scale_w": 700,
        },
        {
            "badge": "VOICE",
            "title": "Multilingual Real-Time Voice Assistant",
            "desc": "Ultra-low latency conversational AI with Tamil, Hindi & English speech synthesis.",
            "color": (26, 16, 48),
            "outline": (168, 85, 247, 180),
            "base_y": 480,
            "offset_y": -20 * fan_progress,
            "scale_w": 760,
        },
        {
            "badge": "WORKSPACE",
            "title": "Intelligent Cosmic Workspace Suite",
            "desc": "Interactive Dev Code sandbox, Gemini Image Studio & Presentation deck builder.",
            "color": (32, 20, 60),
            "outline": (216, 180, 254, 240),
            "base_y": 600,
            "offset_y": 10 * fan_progress,
            "scale_w": 820,
        }
    ]

    for c in cards:
        cw = c["scale_w"]
        ch = 140
        cx = (WIDTH - cw) // 2
        cy = int(c["base_y"] + c["offset_y"] + math.sin(t * 2) * 5)
        
        draw.rounded_rectangle([cx, cy, cx + cw, cy + ch], radius=20, fill=c["color"], outline=c["outline"], width=2)
        # Badge pill
        draw.rounded_rectangle([cx + 35, cy + 22, cx + 120, cy + 50], radius=8, fill=(139, 92, 246, 160))
        draw.text((cx + 45, cy + 26), c["badge"], font=font_small, fill=(255, 255, 255, 255))
        draw.text((cx + 135, cy + 22), c["title"], font=font_bold, fill=(255, 255, 255, 255))
        draw.text((cx + 35, cy + 80), c["desc"], font=font_regular, fill=(200, 190, 230, 255))

    frame_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGBA2BGR)
    out_v4.write(frame_bgr)

out_v4.release()
print("Finished rendering Nova Video Project 4!")
