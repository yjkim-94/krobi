#!/usr/bin/env python3
"""
Nano Banana(또는 임의의 시트 PNG)에서 스프라이트 프레임을 뽑아내는 추출기.

흐름:
  1. 배경 제거 (매직핑크 크로마키 또는 기존 알파, --key auto 지원)
  2. 빈 띠(gap) 기반 분할로 행→칸 자동 탐지  (가로 스트립/격자 모두 대응)
  3. 각 칸을 타이트 크롭 → 지정 크기(기본 64)에 비율 유지 센터링 (LANCZOS)
  4. 팔레트 양자화(기본 32색, 디더 없음)로 픽셀 정리
  5. frame들 투명 PNG로 저장 + 확대 미리보기 시트 출력

사용 예:
  python tools/extract_sprites.py src/assets/pets/_incoming/test_idle.png \
      --out src/assets/pets/krobi --names idle_0,idle_1,idle_2 \
      --size 64 --colors 32 --preview src/assets/pets/_incoming/preview.png
"""
import argparse
import os
import sys
import numpy as np
from PIL import Image


def build_foreground_mask(img, key, tol):
    """전경(캐릭터) 픽셀 = True 인 불리언 마스크 반환."""
    rgba = np.asarray(img.convert("RGBA"))
    rgb = rgba[..., :3].astype(np.int16)
    alpha = rgba[..., 3]

    # 이미 의미있는 투명도가 있으면 그걸 우선 사용
    if (alpha < 250).mean() > 0.02:
        return alpha > 32

    # 키 색 결정
    if key == "auto":
        corners = np.stack([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
        key_rgb = np.median(corners, axis=0)
    else:
        key_rgb = np.array([int(key[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.int16)

    dist = np.sqrt(((rgb - key_rgb) ** 2).sum(axis=2))
    return dist > tol  # 배경에서 멀면 전경


def runs(flags, min_len):
    """True 가 연속된 구간 [(start, end_exclusive), ...] 반환 (min_len 미만 무시)."""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    if start is not None and len(flags) - start >= min_len:
        out.append((start, len(flags)))
    return out


def find_cells(mask, min_frac):
    """빈 띠 기반으로 (행→칸) 분할. 셀 bbox 리스트를 읽기 순서로 반환."""
    h, w = mask.shape
    min_run = max(2, int(min(h, w) * min_frac))
    cells = []
    for (y0, y1) in runs(mask.any(axis=1), min_run):
        band = mask[y0:y1]
        for (x0, x1) in runs(band.any(axis=0), min_run):
            sub = mask[y0:y1, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            xs = np.where(sub.any(axis=0))[0]
            if len(ys) == 0 or len(xs) == 0:
                continue
            cells.append((x0 + xs[0], y0 + ys[0], x0 + xs[-1] + 1, y0 + ys[-1] + 1))
    return cells


def fit_into(img_rgba, mask_full, box, size, margin, scale, anchor):
    """box 영역을 크롭해 공통 scale로 축소하고 size×size 캔버스에 배치.
    anchor='bottom'이면 바닥-가운데 기준(애니 프레임용), 'center'면 정중앙."""
    l, t, r, b = box
    crop = Image.fromarray(img_rgba[t:b, l:r])
    m = mask_full[t:b, l:r]
    crop.putalpha(Image.fromarray((m * 255).astype(np.uint8)))

    cw, ch = crop.size
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - nw) // 2
    y = (size - margin - nh) if anchor == "bottom" else (size - nh) // 2
    canvas.paste(crop, (x, y), crop)
    return canvas


def quantize(img, colors):
    """알파 보존하며 RGB만 팔레트 양자화 (디더 없음)."""
    if colors <= 0:
        return img
    alpha = img.getchannel("A")
    rgb = img.convert("RGB").quantize(colors=colors, dither=Image.Dither.NONE).convert("RGB")
    rgb.putalpha(alpha)
    return rgb


def make_preview(frames, scale, path):
    if not frames:
        return
    s = frames[0].size[0]
    sheet = Image.new("RGBA", (s * len(frames) * scale, s * scale), (40, 44, 60, 255))
    for i, f in enumerate(frames):
        big = f.resize((s * scale, s * scale), Image.NEAREST)
        sheet.alpha_composite(big, (i * s * scale, 0))
    sheet.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--out", required=True)
    ap.add_argument("--names", default="", help="쉼표 구분 프레임 이름 (없으면 frame_0..)")
    ap.add_argument("--size", type=int, default=64)
    ap.add_argument("--margin", type=int, default=2)
    ap.add_argument("--colors", type=int, default=32, help="0 이면 양자화 안 함")
    ap.add_argument("--key", default="ff00ff", help="배경 키 색(hex) 또는 'auto'")
    ap.add_argument("--tol", type=float, default=70, help="배경 색 허용 거리")
    ap.add_argument("--min-frac", type=float, default=0.02, help="띠/간격 최소 비율")
    ap.add_argument("--anchor", choices=["bottom", "center"], default="bottom",
                    help="bottom=바닥 기준(애니 프레임 권장), center=정중앙")
    ap.add_argument("--per-frame-fit", action="store_true",
                    help="끄면(기본) 공통 배율 사용 → 프레임 간 크기 일관. 켜면 각자 꽉 채움")
    ap.add_argument("--preview", default="")
    ap.add_argument("--scale", type=int, default=6, help="미리보기 확대 배율")
    args = ap.parse_args()

    img = Image.open(args.input)
    mask = build_foreground_mask(img, args.key, args.tol)
    rgba = np.asarray(img.convert("RGBA"))

    cells = find_cells(mask, args.min_frac)
    if not cells:
        print("⚠️  전경 덩어리를 못 찾음. --key/--tol 조정 필요.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)
    names = [n.strip() for n in args.names.split(",") if n.strip()]
    print(f"탐지된 프레임: {len(cells)}개")

    # 공통 배율: 모든 프레임 중 최대 폭/높이가 캔버스에 들어가도록 (크기 일관 유지)
    target = args.size - 2 * args.margin
    max_w = max(r - l for (l, t, r, b) in cells)
    max_h = max(b - t for (l, t, r, b) in cells)
    shared_scale = min(target / max_w, target / max_h)

    frames = []
    for i, box in enumerate(cells):
        name = names[i] if i < len(names) else f"frame_{i}"
        l, t, r, b = box
        scale = min(target / (r - l), target / (b - t)) if args.per_frame_fit else shared_scale
        frame = quantize(fit_into(rgba, mask, box, args.size, args.margin, scale, args.anchor), args.colors)
        out_path = os.path.join(args.out, f"{name}.png")
        frame.save(out_path)
        frames.append(frame)
        print(f"  [{i}] {box} -> {out_path}")

    if args.preview:
        make_preview(frames, args.scale, args.preview)
        print(f"미리보기: {args.preview}")


if __name__ == "__main__":
    main()
