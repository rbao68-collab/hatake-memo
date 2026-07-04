#!/usr/bin/env python3
# 畑メモ アイコン生成（標準ライブラリのみ・外部依存なし）
# 緑の角丸背景 + 白い双葉の芽を描き、192/512/180 px の PNG を出力。
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), '..')

GREEN  = (74, 124, 47)     # #4a7c2f
CREAM  = (238, 243, 226)   # 双葉（明るいクリーム）
STEMC  = (214, 227, 191)   # 茎（少し濃いめ）

def in_rounded_rect(u, v, r):
    cx = min(max(u, r), 1 - r)
    cy = min(max(v, r), 1 - r)
    dx, dy = u - cx, v - cy
    return dx * dx + dy * dy <= r * r

def in_ellipse(u, v, cx, cy, ang, rx, ry):
    dx, dy = u - cx, v - cy
    ca, sa = math.cos(ang), math.sin(ang)
    xr =  dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    return (xr / rx) ** 2 + (yr / ry) ** 2 <= 1

def color_at(u, v):
    # 背景（角丸）外は透明
    if not in_rounded_rect(u, v, 0.18):
        return (0, 0, 0, 0)
    # 茎（中央の縦棒、上細り気味に矩形近似）
    if abs(u - 0.5) <= 0.030 and 0.44 <= v <= 0.72:
        return STEMC + (255,)
    # 双葉（左右の楕円）。vは下向きが正なので上へ伸びるよう角度を設定。
    if in_ellipse(u, v, 0.375, 0.470, math.radians(-32), 0.150, 0.072):
        return CREAM + (255,)
    if in_ellipse(u, v, 0.625, 0.470, math.radians(32), 0.150, 0.072):
        return CREAM + (255,)
    return GREEN + (255,)

def render(size, ss=3):
    """size px を ss 倍でスーパーサンプリングして箱平均でダウンサンプル→簡易AA。"""
    S = size * ss
    # スーパーサンプル各画素の色を先に計算
    row_colors = []
    for y in range(S):
        v = (y + 0.5) / S
        row = []
        for x in range(S):
            u = (x + 0.5) / S
            row.append(color_at(u, v))
        row_colors.append(row)
    # ダウンサンプル
    out = bytearray(size * size * 4)
    n = ss * ss
    for oy in range(size):
        for ox in range(size):
            ar = ag = ab = aa = 0
            for j in range(ss):
                srow = row_colors[oy * ss + j]
                for i in range(ss):
                    r, g, b, a = srow[ox * ss + i]
                    # 透明画素は色を混ぜない（アルファ加重）
                    ar += r * a; ag += g * a; ab += b * a; aa += a
            idx = (oy * size + ox) * 4
            if aa == 0:
                out[idx:idx+4] = b'\x00\x00\x00\x00'
            else:
                out[idx+0] = ar // aa
                out[idx+1] = ag // aa
                out[idx+2] = ab // aa
                out[idx+3] = aa // n
    return bytes(out)

def write_png(path, size, rgba):
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data +
                struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # 8bit RGBA
    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        raw += rgba[y * stride:(y + 1) * stride]
    idat = zlib.compress(bytes(raw), 9)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

if __name__ == '__main__':
    for sz in (512, 192, 180):
        print('rendering', sz, '...')
        px = render(sz)
        p = os.path.join(OUT, f'icon-{sz}.png')
        write_png(p, sz, px)
        print('  ->', p, os.path.getsize(p), 'bytes')
    print('done')
