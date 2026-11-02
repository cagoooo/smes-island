# 由方案 docx 的原圖產生閱讀標章：裁掉透明空白後放大，不重畫圖案
# 用法：python scripts/make-badges.py <方案.docx>
import io
import os
import sys
import zipfile

from PIL import Image, ImageFilter

IDS = [145, 146, 147, 148, 157]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'images', 'badge')
SIZE = 640
PAD = 0.04  # 留一點邊，圖案才不會貼齊圓框


def badge(data):
    im = Image.open(io.BytesIO(data)).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox())
    box = int(SIZE * (1 - PAD * 2))
    k = box / max(im.size)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=3, percent=60, threshold=2))
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return out


os.makedirs(OUT, exist_ok=True)
with zipfile.ZipFile(sys.argv[1]) as z:
    for i in IDS:
        im = badge(z.read(f'word/media/image{i}.png'))
        path = os.path.join(OUT, f'{i}.webp')
        im.save(path, quality=90, method=6)
        print(i, im.size, os.path.getsize(path) // 1024, 'KB')
