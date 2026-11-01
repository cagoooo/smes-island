# 由魚閱時光吉祥物與校徽產生網站圖示，並把場景截圖合成社群分享圖
# 用法：python scripts/make-icons.py <吉祥物 PNG> <校徽去背 PNG> <場景截圖 PNG>
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FISH, LOGO, SHOT = sys.argv[1:4]
OUT = 'public/'
TOP, BOTTOM = (47, 143, 216), (160, 216, 240)


def sky(size):
    im = Image.new('RGB', (size, size))
    px = im.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    return im.convert('RGBA')


def icon(size, scale, rounded):
    base = sky(size)
    fish = Image.open(FISH).convert('RGBA')
    s = round(size * scale)
    fish = fish.resize((s, s), Image.LANCZOS)
    base.alpha_composite(fish, ((size - s) // 2, (size - s) // 2))
    if rounded:
        mask = Image.new('L', (size * 4, size * 4), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4, size * 4), radius=size * 4 // 5, fill=255)
        base.putalpha(mask.resize((size, size), Image.LANCZOS))
    return base


icon(180, 0.84, False).convert('RGB').save(OUT + 'apple-touch-icon.png', optimize=True)
icon(192, 0.86, True).save(OUT + 'icon-192.png', optimize=True)
icon(512, 0.86, True).save(OUT + 'icon-512.png', optimize=True)
icon(192, 0.62, False).save(OUT + 'icon-192-maskable.png', optimize=True)
icon(512, 0.62, False).save(OUT + 'icon-512-maskable.png', optimize=True)
fav = icon(64, 0.92, True)
fav.save(OUT + 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

# ── 社群分享圖 1200×630 ──
W, H = 1200, 630
shot = Image.open(SHOT).convert('RGB').resize((W, H), Image.LANCZOS).convert('RGBA')
veil = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(veil)
d.rounded_rectangle((36, 34, 716, 214), radius=26, fill=(251, 244, 230, 240))
d.rounded_rectangle((44, 42, 708, 206), radius=20, outline=(201, 180, 140, 255), width=2)
shot.alpha_composite(veil)
logo = Image.open(LOGO).convert('RGBA')
logo.thumbnail((128, 128), Image.LANCZOS)
shot.alpha_composite(logo, (60, 60))
draw = ImageDraw.Draw(shot)
title = ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', 46)
sub = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 27)
draw.text((204, 62), '桃園市石門國小', font=title, fill=(59, 44, 29))
draw.text((204, 112), '品牌群島', font=title, fill=(169, 48, 32))
draw.text((204, 168), '鱻鯉鰭源，石門活閱｜十二座浮空島', font=sub, fill=(106, 85, 65))
shot.convert('RGB').save(OUT + 'og.jpg', quality=88, optimize=True)
print('圖示與分享圖完成')
