#!/usr/bin/env python3
# 畑メモ 横版A5チラシ（/flyer）用 — QRコードをインラインSVGとして生成し、
# flyer.html の <!-- QR:START --> ～ <!-- QR:END --> の間に埋め込む。
#
# 目的: 印刷用チラシから外部リクエスト（qr.png 等）を完全に排除する。
#       SVGパスなのでベクター＝拡大しても潰れず、印刷が鮮明。
# 依存: pip3 の qrcode（アプリ本体の「無外部依存」原則とは別枠のビルド用ツール）。
#   使い方: python3 tools/make_flyer.py [URL]
#   既定URL: https://hatake-memo.rbao68.workers.dev/   （サイトのルートURL）
import os
import sys

import qrcode

DEFAULT_URL = 'https://hatake-memo.rbao68.workers.dev/'
BORDER = 4  # 余白（クワイエットゾーン）モジュール数。読み取り安定のため4。
START = '<!-- QR:START -->'
END = '<!-- QR:END -->'


def build_qr_svg(url: str):
    """URL から QR を生成し、自己完結したインラインSVG文字列を返す。"""
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # レベルM
        border=0,  # 余白は自前で付ける
    )
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    n = len(matrix)
    total = n + BORDER * 2  # 余白込みの一辺モジュール数

    # 暗モジュールを1本のパスにまとめる（余白ぶんオフセット）。
    segs = []
    for r, row in enumerate(matrix):
        for c, dark in enumerate(row):
            if dark:
                x = c + BORDER
                y = r + BORDER
                segs.append(f'M{x} {y}h1v1h-1z')
    path = ''.join(segs)

    svg = (
        f'<svg class="qr-img" viewBox="0 0 {total} {total}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" '
        f'aria-label="畑メモ QRコード" '
        f'shape-rendering="crispEdges">'
        f'<rect width="{total}" height="{total}" fill="#fff"/>'
        f'<path d="{path}" fill="#000"/>'
        f'</svg>'
    )
    return svg, qr.version, n


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    root = os.path.join(os.path.dirname(__file__), '..')
    flyer = os.path.join(root, 'flyer.html')

    svg, version, modules = build_qr_svg(url)

    with open(flyer, encoding='utf-8') as f:
        html = f.read()

    if START not in html or END not in html:
        sys.exit(f'markers {START} / {END} not found in flyer.html')

    before = html.split(START)[0]
    after = html.split(END)[1]
    html = f'{before}{START}\n        {svg}\n        {END}{after}'

    with open(flyer, 'w', encoding='utf-8') as f:
        f.write(html)

    print('URL          :', url)
    print('QR version   :', version, f'({modules}x{modules} modules + border {BORDER})')
    print('error correct: M')
    print('SVG bytes    :', len(svg))
    print('injected into:', os.path.abspath(flyer))


if __name__ == '__main__':
    main()
