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
    rgb = rgba[..., :3].astype(np.int32)  # int16이면 제곱 시 오버플로 → nan
    alpha = rgba[..., 3]

    # 이미 의미있는 투명도가 있으면 그걸 우선 사용
    if (alpha < 250).mean() > 0.02:
        return alpha > 32

    # 키 색 결정
    if key == "auto":
        corners = np.stack([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
        key_rgb = np.median(corners, axis=0)
    else:
        key_rgb = np.array([int(key[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.int32)

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


def split_axis(flags, count, noise=2):
    """1D 전경 flags 를 정확히 count개 구간으로 분할.

    전경 run들 사이 간격 중 **가장 큰 (count-1)개에서만** 자른다 → 그보다 작은
    내부 간격(본체↔부가효과: 반짝이/불꽃/번개/얼음/안개/광휘 등)은 한 구간에 묶여
    잘리지 않는다. noise(px) 이하 폭의 run은 1px 잡티로 보고 무시.
    반환: [(start, end_exclusive), ...] (구간 수 = min(count, run 수))."""
    spans = runs(flags, noise)
    if not spans:
        return []
    if count <= 1 or len(spans) == 1:
        return [(spans[0][0], spans[-1][1])]
    # span[i] 와 span[i+1] 사이 간격 폭
    gaps = [(spans[i + 1][0] - spans[i][1], i) for i in range(len(spans) - 1)]
    n_cuts = min(count - 1, len(gaps))
    # 가장 큰 간격부터 n_cuts개 선택 → 그 뒤에서 자름
    cut_after = sorted(i for _, i in sorted(gaps, key=lambda g: (-g[0], g[1]))[:n_cuts])
    out, start = [], 0
    for ca in cut_after:
        out.append((spans[start][0], spans[ca][1]))
        start = ca + 1
    out.append((spans[start][0], spans[-1][1]))
    return out


def find_cells_grid(mask, rows, cols):
    """행 수·열 수가 알려진 격자 분할(largest-gap). 떨어진 부가효과를 해당 프레임에 포함.
    셀 bbox 리스트를 읽기 순서(행→열)로 반환."""
    cells = []
    for (y0, y1) in split_axis(mask.any(axis=1), rows):
        band = mask[y0:y1]
        for (x0, x1) in split_axis(band.any(axis=0), cols):
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


def place_preserve(img_rgba, mask_full, box, size, margin, scale, row_base_b):
    """공통 scale로 축소하되 **행 공통 바닥(row_base_b)** 기준으로 수직 위치를 보존.
    제자리 프레임은 바닥에, 공중에 뜬 프레임은 그만큼 들어올려 배치 → 점프/이동 유지.
    가로는 콘텐츠 중심 정렬."""
    l, t, r, b = box
    crop = Image.fromarray(img_rgba[t:b, l:r])
    m = mask_full[t:b, l:r]
    crop.putalpha(Image.fromarray((m * 255).astype(np.uint8)))

    cw, ch = crop.size
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - nw) // 2
    lift = round((row_base_b - b) * scale)  # 바닥 위로 떠 있는 높이
    y = (size - margin - nh) - lift
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
    ap.add_argument("--min-frac", type=float, default=0.02, help="띠/간격 최소 비율 (auto 모드)")
    ap.add_argument("--cols", type=int, default=0,
                    help="행당 프레임 수. >0 이면 격자 모드(largest-gap)로 분할 → "
                         "떨어진 부가효과(반짝이/불꽃/번개/얼음/안개/광휘)도 프레임에 포함")
    ap.add_argument("--rows", type=int, default=0,
                    help="행 수(격자 모드). 0이면 names/cols 로 추정(없으면 1=단일 스트립)")
    ap.add_argument("--anchor", choices=["bottom", "center", "preserve"], default="bottom",
                    help="bottom=바닥 기준(제자리 동작), center=정중앙, "
                         "preserve=행 공통 바닥 기준 수직위치 보존(점프/이동 동작; --cols 필요)")
    ap.add_argument("--per-frame-fit", action="store_true",
                    help="끄면(기본) 공통 배율 사용 → 프레임 간 크기 일관. 켜면 각자 꽉 채움")
    ap.add_argument("--preview", default="")
    ap.add_argument("--scale", type=int, default=6, help="미리보기 확대 배율")
    args = ap.parse_args()

    img = Image.open(args.input)
    mask = build_foreground_mask(img, args.key, args.tol)
    rgba = np.asarray(img.convert("RGBA"))

    names = [n.strip() for n in args.names.split(",") if n.strip()]
    if args.cols > 0:
        rows = args.rows if args.rows > 0 else (max(1, round(len(names) / args.cols)) if names else 1)
        cells = find_cells_grid(mask, rows, args.cols)
    else:
        cells = find_cells(mask, args.min_frac)
    if not cells:
        print("⚠️  전경 덩어리를 못 찾음. --key/--tol 조정 필요.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out, exist_ok=True)
    print(f"탐지된 프레임: {len(cells)}개")

    target = args.size - 2 * args.margin

    if args.anchor == "preserve":
        if args.cols <= 0:
            print("⚠️  --anchor preserve 는 --cols(행당 프레임 수) 필요.", file=sys.stderr)
            sys.exit(1)
        cols = args.cols
        rows_cells = [cells[i:i + cols] for i in range(0, len(cells), cols)]
        # 공통 배율: 최대 폭 + 행별 수직 점프 범위(바닥~정점) 모두 캔버스에 들어가게
        w_extent = max(r - l for (l, t, r, b) in cells)
        h_extent = max(max(b for (_, _, _, b) in rc) - min(t for (_, t, _, _) in rc)
                       for rc in rows_cells)
        shared_scale = min(target / w_extent, target / h_extent)
        # (box, 행 공통 바닥) 평탄화 — cells 와 같은 읽기 순서
        placements = [(box, max(b for (_, _, _, b) in rc)) for rc in rows_cells for box in rc]
    else:
        max_w = max(r - l for (l, t, r, b) in cells)
        max_h = max(b - t for (l, t, r, b) in cells)
        shared_scale = min(target / max_w, target / max_h)
        placements = [(box, None) for box in cells]

    frames = []
    for i, (box, row_base_b) in enumerate(placements):
        name = names[i] if i < len(names) else f"frame_{i}"
        l, t, r, b = box
        if args.anchor == "preserve":
            frame = place_preserve(rgba, mask, box, args.size, args.margin, shared_scale, row_base_b)
        else:
            scale = min(target / (r - l), target / (b - t)) if args.per_frame_fit else shared_scale
            frame = fit_into(rgba, mask, box, args.size, args.margin, scale, args.anchor)
        frame = quantize(frame, args.colors)
        out_path = os.path.join(args.out, f"{name}.png")
        frame.save(out_path)
        frames.append(frame)
        print(f"  [{i}] {box} -> {out_path}")

    if args.preview:
        make_preview(frames, args.scale, args.preview)
        print(f"미리보기: {args.preview}")


if __name__ == "__main__":
    main()
