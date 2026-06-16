#!/usr/bin/env python3
"""개별 프레임 PNG들을 격자 스프라이트 시트 1장 + 인덱스 기반 manifest로 병합.

입력: <form_dir>/manifest.json (frames 가 프레임 파일명 배열인 구버전 스키마) + 프레임 PNG들.
출력: <form_dir>/sheet.png (격자 시트) + manifest.json 을 인덱스 스키마로 재작성.
      (기본은 병합 후 개별 프레임 PNG 삭제 → 폼 폴더에 sheet.png + manifest.json 만 남김.)

사용 예:
  tools/venv/bin/python tools/pack_sheet.py src/assets/pets/krobi/stage1 --columns 8
"""
import argparse
import json
import os
import sys

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("form_dir", help="manifest.json + 프레임 PNG들이 있는 폼 폴더")
    ap.add_argument("--columns", type=int, default=8, help="시트 격자 열 수")
    ap.add_argument("--sheet-name", default="sheet.png")
    ap.add_argument("--keep-frames", action="store_true",
                    help="병합 후 개별 프레임 PNG 보존(기본은 삭제)")
    args = ap.parse_args()

    mpath = os.path.join(args.form_dir, "manifest.json")
    with open(mpath, encoding="utf-8") as f:
        manifest = json.load(f)

    if "sheet" in manifest:
        print("⚠️  이미 시트 기반 manifest 임 (frames 가 인덱스). 중단.", file=sys.stderr)
        sys.exit(1)

    fs = manifest["frameSize"]
    anims = manifest["animations"]

    # 애니 순서대로 등장하는 프레임 이름을 '처음 본 순서'로 수집(중복 제거 → 셀 공유)
    cell_of, order = {}, []
    for anim in anims.values():
        for name in anim["frames"]:
            if name not in cell_of:
                cell_of[name] = len(order)
                order.append(name)

    cols = args.columns
    rows = (len(order) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * fs, rows * fs), (0, 0, 0, 0))
    for i, name in enumerate(order):
        fp = os.path.join(args.form_dir, f"{name}.png")
        if not os.path.exists(fp):
            print(f"⚠️  프레임 없음: {fp}", file=sys.stderr)
            sys.exit(1)
        img = Image.open(fp).convert("RGBA")
        if img.size != (fs, fs):
            img = img.resize((fs, fs), Image.NEAREST)
        sheet.alpha_composite(img, ((i % cols) * fs, (i // cols) * fs))

    sheet.save(os.path.join(args.form_dir, args.sheet_name))

    # manifest 를 인덱스 스키마로 재작성 (키 순서: id, frameSize, displayScale, sheet, columns, animations)
    for anim in anims.values():
        anim["frames"] = [cell_of[name] for name in anim["frames"]]
    new_manifest = {
        "id": manifest["id"],
        "frameSize": fs,
        "displayScale": manifest["displayScale"],
        "sheet": args.sheet_name,
        "columns": cols,
        "animations": anims,
    }
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(new_manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    if not args.keep_frames:
        for name in order:
            os.remove(os.path.join(args.form_dir, f"{name}.png"))

    print(f"시트: {cols}x{rows} ({len(order)} frames) -> {args.sheet_name}")


if __name__ == "__main__":
    main()
