#!/usr/bin/env python3
"""한 폼을 한 번에 빌드: 시트 추출 → draft manifest 작성 → sheet.png + 인덱스 manifest 패킹.

extract_sprites.py 와 pack_sheet.py 를 순차 호출하고, 그 사이의 draft manifest 작성을
대신해 주는 래퍼. 표준 폼 = idle/eat/happy/sad 각 8프레임(총 32), 풀시트(4행 × N열) 기준.

사용 예 (풀 파이프라인):
  tools/venv/bin/python tools/build_form.py \
      src/assets/pets/_incoming/krombi_stage1_sheet.png \
      --out src/assets/pets/krombi/stage1 --size 64

검수 게이트용 (추출 + 프리뷰까지만, 패킹 보류):
  ... --no-pack      # 프리뷰 확인 후 같은 명령을 --no-pack 없이 다시 실행하면 패킹까지 완료
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

ANIMS = ["idle", "eat", "happy", "sad"]
FPS = {"idle": 8, "eat": 10, "happy": 10, "sad": 4}
LOOP = {"idle": True, "eat": False, "happy": False, "sad": True}
THEN = {"eat": "idle", "happy": "idle"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="_incoming 의 풀시트 PNG")
    ap.add_argument("--out", required=True, help="폼 폴더 (예: src/assets/pets/krombi/stage1)")
    ap.add_argument("--size", type=int, default=64, help="frameSize (stage1/2=64, stage3=96)")
    ap.add_argument("--columns", type=int, default=8, help="행당 프레임 수 = 시트 열 수")
    ap.add_argument("--anchor", default="preserve", choices=["bottom", "center", "preserve"],
                    help="기본 preserve(happy 도약 보존, 제자리 행은 bottom 처럼 동작)")
    ap.add_argument("--colors", type=int, default=32)
    ap.add_argument("--tol", type=float, default=120)
    ap.add_argument("--key", default="ff00ff")
    ap.add_argument("--display-scale", type=int, default=2)
    ap.add_argument("--id", default="", help="비우면 out 경로에서 <species>/<form> 추론")
    ap.add_argument("--preview", default="", help="비우면 input 옆에 <stem>_preview.png")
    ap.add_argument("--no-pack", action="store_true",
                    help="추출 + draft manifest + 프리뷰까지만, 패킹 보류(검수 게이트용)")
    ap.add_argument("--keep-frames", action="store_true", help="패킹 후 개별 프레임 보존")
    args = ap.parse_args()

    cols = args.columns
    names = [f"{a}_{i}" for a in ANIMS for i in range(cols)]  # 읽기 순서(행→열)

    preview = args.preview
    if not preview:
        stem = os.path.splitext(os.path.basename(args.input))[0]
        stem = stem[:-6] if stem.endswith("_sheet") else stem
        preview = os.path.join(os.path.dirname(args.input), f"{stem}_preview.png")

    # 1) 추출 ------------------------------------------------------------------
    extract_cmd = [
        PY, os.path.join(HERE, "extract_sprites.py"), args.input,
        "--out", args.out, "--names", ",".join(names),
        "--size", str(args.size), "--colors", str(args.colors), "--tol", str(args.tol),
        "--key", args.key, "--anchor", args.anchor,
        "--rows", str(len(ANIMS)), "--cols", str(cols),
        "--preview", preview,
    ]
    print("▶ 추출:", " ".join(extract_cmd))
    subprocess.run(extract_cmd, check=True)

    # 2) draft manifest -------------------------------------------------------
    if args.id:
        form_id = args.id
    else:
        out_norm = os.path.normpath(args.out)
        form_id = f"{os.path.basename(os.path.dirname(out_norm))}/{os.path.basename(out_norm)}"
    manifest = {
        "id": form_id,
        "frameSize": args.size,
        "displayScale": args.display_scale,
        "animations": {
            a: {
                "frames": [f"{a}_{i}" for i in range(cols)],
                "fps": FPS[a],
                "loop": LOOP[a],
                **({"then": THEN[a]} if a in THEN else {}),
            }
            for a in ANIMS
        },
    }
    mpath = os.path.join(args.out, "manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"✎ draft manifest: {mpath}  (id={form_id})")

    if args.no_pack:
        print(f"⏸ --no-pack: 프리뷰({preview}) 확인 후 같은 명령을 --no-pack 없이 다시 실행하세요.")
        return

    # 3) 패킹 ------------------------------------------------------------------
    pack_cmd = [PY, os.path.join(HERE, "pack_sheet.py"), args.out, "--columns", str(cols)]
    if args.keep_frames:
        pack_cmd.append("--keep-frames")
    print("▶ 패킹:", " ".join(pack_cmd))
    subprocess.run(pack_cmd, check=True)
    print(f"✓ 완료: {os.path.join(args.out, 'sheet.png')} + manifest.json")


if __name__ == "__main__":
    main()
