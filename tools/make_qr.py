#!/usr/bin/env python3
# 挨拶状用 QRコード生成（印刷用ローカルツール）
# アプリ本体の「無外部依存」原則とは別枠。pip3 の qrcode ライブラリを使う。
#   使い方: python3 tools/make_qr.py [URL]
#   既定URL: https://hatake-memo.rbao68.workers.dev
#   出力:    letter/qr.png（誤り訂正レベルM・余白4モジュール）
import os
import sys

import qrcode

DEFAULT_URL = 'https://hatake-memo.rbao68.workers.dev'

def main():
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'letter')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, 'qr.png')

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,  # レベルM（≧M）
        box_size=10,
        border=4,                                           # 余白4モジュール
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    img.save(out)

    print('URL          :', url)
    print('version      :', qr.version, '(modules per side:', 21 + (qr.version - 1) * 4, ')')
    print('error correct: M')
    print('border       : 4 modules')
    print('saved        :', os.path.abspath(out), os.path.getsize(out), 'bytes')

if __name__ == '__main__':
    main()
