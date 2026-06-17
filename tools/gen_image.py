#!/usr/bin/env python3
"""
Image generation wrapper for the add-pet pipeline.

Usage:
  tools/venv/bin/python tools/gen_image.py <prompt_file> --out <path> \
      [--size WxH] [--ref <image>]

Requires OPENAI_API_KEY (set in tools/.env or the environment).
"""
import argparse
import base64
import os
import sys

import openai
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Generate a pet sprite sheet image")
    p.add_argument("prompt_file", help="Path to plain-text file with the full prompt")
    p.add_argument("--out", required=True, help="Output PNG path (e.g. src/assets/pets/_incoming/species_form_sheet.png)")
    p.add_argument("--size", default="1536x1024", help="Image dimensions WxH (default: 1536x1024)")
    p.add_argument("--ref", default=None, help="Reference image path for style/identity consistency")
    return p


def generate(prompt: str, size: str, ref: str | None, out: str) -> None:
    client = openai.OpenAI()
    if ref:
        with open(ref, "rb") as f:
            resp = client.images.edit(
                model="gpt-image-2",
                image=f,
                prompt=prompt,
                size=size,
            )
    else:
        resp = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size=size,
        )
    with open(out, "wb") as f:
        f.write(base64.b64decode(resp.data[0].b64_json))


def main() -> None:
    args = _build_parser().parse_args()

    with open(args.prompt_file) as f:
        prompt = f.read().strip()

    if not prompt:
        sys.exit(f"Prompt file is empty: {args.prompt_file}")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    print(f"[gen_image] size={args.size}  out={args.out}", flush=True)
    generate(prompt, args.size, args.ref, args.out)
    print(f"[gen_image] saved → {args.out}")


if __name__ == "__main__":
    main()
