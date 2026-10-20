import subprocess, math, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "screenshots/"  # run from docs/marketing; needs Pillow, ffmpeg and the Poppins fonts
FD = "/usr/share/fonts/truetype/google-fonts/"
W, H, FPS = 1080, 1920, 30
OUT = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/vid/walkthrough.mp4"

def F(style, size): return ImageFont.truetype(FD + f"Poppins-{style}.ttf", size)

NAVY = (13, 29, 58); BLUE = (30, 91, 184); YEL = (242, 193, 78); WHITE = (255, 255, 255)
SUB = (205, 222, 255); DIM = (150, 175, 220)

# background gradient (diagonal, like the launch post)
def gradient():
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for y in range(H):
        for x in range(0, W):
            t = min(1, max(0, (x / W) * 0.35 + (y / H) * 0.85 - 0.1))
            px[x, y] = tuple(int(NAVY[i] + (BLUE[i] - NAVY[i]) * t) for i in range(3))
    return bg
BG = gradient()

shots = {k: Image.open(SRC + f).convert("RGB") for k, f in
         [("setup", "1-setup.png"), ("dash", "2-dashboard.png"), ("money", "3-money-in-out.png"),
          ("check", "4-checklists.png"), ("reports", "5-reports.png")]}

# window where the screenshot plays
WX, WY, WW, WH = 60, 700, 960, 1000
R = 36
ASP = WH / WW

def ease(t): return 4*t*t*t if t < .5 else 1 - pow(-2*t + 2, 3) / 2

def crop_rect(x, y, w):
    h = w * ASP
    if h > 900: h = 900; w = h / ASP
    x = min(max(0, x), 1440 - w); y = min(max(0, y), 900 - h)
    return (x, y, w, h)

def window_img(shot, a, b, t):
    a = crop_rect(*a); b = crop_rect(*b); e = ease(t)
    x, y, w, h = [a[i] + (b[i] - a[i]) * e for i in range(4)]
    return shot.resize((WW, WH), Image.LANCZOS, box=(x, y, x + w, y + h))

MASK = Image.new("L", (WW, WH), 0); ImageDraw.Draw(MASK).rounded_rectangle((0, 0, WW - 1, WH - 1), R, fill=255)
SHADOW = Image.new("L", (W, H), 0)
ImageDraw.Draw(SHADOW).rounded_rectangle((WX + 10, WY + 30, WX + WW + 10, WY + WH + 30), R + 10, fill=150)
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(30))

def paste_window(fr, win, alpha=1.0):
    fr.paste((5, 12, 30), (0, 0), SHADOW.point(lambda v: int(v * alpha)))
    d = ImageDraw.Draw(fr)
    d.rounded_rectangle((WX - 8, WY - 8, WX + WW + 8, WY + WH + 8), R + 8, fill=(236, 242, 252))
    fr.paste(win, (WX, WY), MASK)

def brand(d):
    d.rounded_rectangle((60, 80, 150, 170), 22, fill=BLUE, outline=(120, 160, 230), width=3)
    f = F("Bold", 40); d.text((105, 126), "BL", font=f, fill=WHITE, anchor="mm")
    d.text((172, 96), "Business Ledger", font=F("Bold", 42), fill=WHITE)
    d.text((174, 146), "Books for every side business", font=F("Regular", 26), fill=DIM)

def pill(d, x, y, text, fill=YEL, color=NAVY, size=30):
    f = F("Bold", size); tw = d.textlength(text, font=f)
    d.rounded_rectangle((x, y, x + tw + 48, y + size + 30), 14, fill=fill)
    d.text((x + 24, y + 13), text, font=f, fill=color)

def wrap(d, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w_
    lines.append(cur); return lines

def caption(fr, step, title, sub, k):
    # k: 0..1 entrance progress
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    pill(d, 60, 240, f"STEP {step} OF 5")
    ft = F("Bold", 74); y = 330
    for ln in wrap(d, title, ft, 960):
        d.text((60, y), ln, font=ft, fill=WHITE); y += 88
    fs = F("Regular", 38); y += 14
    for ln in wrap(d, sub, fs, 960):
        d.text((60, y), ln, font=fs, fill=SUB); y += 52
    a = ease(min(1, k)); off = int((1 - a) * 40)
    layer = layer.transform(layer.size, Image.AFFINE, (1, 0, 0, 0, 1, -off))
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    fr.paste(layer, (0, 0), layer)

def dots(d, active):
    cx0 = W // 2 - 2 * 44
    for i in range(5):
        cx = cx0 + i * 44
        if i == active: d.rounded_rectangle((cx - 22, 1772, cx + 22, 1788), 8, fill=YEL)
        else: d.ellipse((cx - 8, 1772, cx + 8, 1788), fill=(110, 140, 200))

def footer(d, text="One-time buy · No subscription · Your data stays on your PC"):
    d.text((W // 2, 1850), text, font=F("Medium", 28), fill=DIM, anchor="mm")

SCENES = [
    ("setup", "Set up in a minute", "Add each business, pick ZAR and VAT. No account needed.",
     (300, 40, 860), (400, 60, 640)),
    ("dash", "See profit per business", "Income, expenses and net profit for every trade in one place.",
     (0, 0, 880), (560, 60, 860)),
    ("money", "Log money in and out", "Tag each record to a business and category. Export to CSV anytime.",
     (290, 90, 470), (770, 100, 640)),
    ("check", "Stay on top of the admin", "Daily, weekly and monthly to-dos that reset themselves.",
     (280, 90, 760), (660, 520, 760)),
    ("reports", "Reports for the SA tax year", "1 March to 28/29 Feb, with an ITR12 helper and CSV export.",
     (280, 90, 760), (300, 350, 560)),
]
INTRO, SCENE, OUTRO, XF = 3.5, 6.4, 5.5, 0.5

def intro_frame(t):
    fr = BG.copy(); d = ImageDraw.Draw(fr)
    a = ease(min(1, t / 0.8))
    win = window_img(shots["dash"], (0, 0, 880), (120, 40, 800), min(1, t / INTRO))
    # fade window in
    base = fr.copy(); paste_window(fr, win); fr = Image.blend(base, fr, a)
    d = ImageDraw.Draw(fr); brand(d)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dl = ImageDraw.Draw(layer)
    pill(dl, 60, 250, "ONE-TIME BUY · NO SUBSCRIPTION")
    dl.text((56, 330), "Keep the books", font=F("Bold", 96), fill=WHITE)
    dl.text((56, 440), "for every side", font=F("Bold", 96), fill=WHITE)
    dl.text((56, 550), "business.", font=F("Bold", 96), fill=YEL)
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    fr.paste(layer, (0, 0), layer); footer(ImageDraw.Draw(fr), "Made in South Africa for side-hustle owners")
    return fr

def scene_frame(i, t):
    key, title, sub, a, b = SCENES[i]
    fr = BG.copy(); d = ImageDraw.Draw(fr); brand(d)
    paste_window(fr, window_img(shots[key], a, b, min(1, max(0, (t - 0.3) / (SCENE - 0.6)))))
    caption(fr, i + 1, title, sub, t / 0.6)
    d = ImageDraw.Draw(fr); dots(d, i)
    footer(d, "Helper only, not tax advice" if key == "reports" else
           "One-time buy · No subscription · Your data stays on your PC")
    return fr

def outro_frame(t):
    fr = BG.copy(); d = ImageDraw.Draw(fr); brand(d)
    a = ease(min(1, t / 0.7))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dl = ImageDraw.Draw(layer)
    pill(dl, 60, 300, "FOUNDERS PRICE")
    dl.text((56, 390), "R179", font=F("Bold", 230), fill=YEL)
    f = F("Medium", 64); dl.text((620, 520), "R299", font=f, fill=DIM)
    tw = dl.textlength("R299", font=f); dl.line((620, 562, 620 + tw, 562), fill=DIM, width=6)
    dl.text((60, 680), "for the first 50 buyers,", font=F("Medium", 50), fill=WHITE)
    dl.text((60, 745), "then R299. Pay once, keep it.", font=F("Medium", 50), fill=WHITE)
    y = 900
    for ln in ["Multi-business books", "South African tax year built in", "Runs in Chrome, data stays on your PC",
               "No monthly fees"]:
        dl.ellipse((66, y + 20, 90, y + 44), fill=YEL)
        dl.text((112, y + 4), ln, font=F("Regular", 44), fill=SUB); y += 84
    # CTA button (slight pulse)
    s = 1 + 0.03 * math.sin(max(0, t - 0.8) * 5)
    bw, bh = int(840 * s), int(150 * s); bx = (W - bw) // 2; by = 1350 + (150 - bh) // 2
    dl.rounded_rectangle((bx, by, bx + bw, by + bh), 34, fill=YEL)
    dl.text((W // 2, by + bh // 2), "Get it: link in bio", font=F("Bold", 62), fill=NAVY, anchor="mm")
    dl.text((W // 2, 1590), "Business Ledger on Gumroad", font=F("Medium", 38), fill=WHITE, anchor="mm")
    layer.putalpha(layer.getchannel("A").point(lambda v: int(v * a)))
    fr.paste(layer, (0, 0), layer)
    footer(ImageDraw.Draw(fr), "Not accounting or tax advice · Single user, not cloud")
    return fr

segs = [(INTRO, intro_frame)] + [(SCENE, (lambda i: lambda t: scene_frame(i, t))(i)) for i in range(5)] + [(OUTRO, outro_frame)]
total = sum(s[0] for s in segs) - XF * (len(segs) - 1)
N = int(round(total * FPS))
starts, acc = [], 0
for dur, _ in segs: starts.append(acc); acc += dur - XF

import os
if os.environ.get("PREVIEW"):
    for T in map(float, os.environ["PREVIEW"].split(",")):
        active=[(k,T-starts[k]) for k in range(len(segs)) if 0<=T-starts[k]<segs[k][0]]
        k,t=active[-1]; segs[k][1](t).save(f"prev_{T:05.1f}.png")
    raise SystemExit
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                       "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
for n in range(N):
    T = n / FPS
    active = [(k, T - starts[k]) for k in range(len(segs)) if 0 <= T - starts[k] < segs[k][0]]
    k, t = active[-1]
    fr = segs[k][1](t)
    if len(active) > 1 and t < XF:
        pk, pt = active[-2]
        fr = Image.blend(segs[pk][1](pt), fr, ease(t / XF))
    ff.stdin.write(fr.tobytes())
ff.stdin.close(); ff.wait()
print("frames", N, "seconds", round(total, 2))
