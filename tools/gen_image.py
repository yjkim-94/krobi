#!/usr/bin/env python3
"""
Image generation wrapper for the add-pet pipeline.

Usage:
  tools/venv/bin/python tools/gen_image.py <prompt_file> --out <path> \
      [--size WxH] [--backend oauth|api] [--ref <image>]

Backends:
  oauth (default)  chatgpt-imagegen subprocess, no API key required
  api              openai SDK, requires OPENAI_API_KEY env var; --ref is active
"""
import argparse
import os
import subprocess
import sys


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Generate a pet sprite sheet image")
    p.add_argument("prompt_file", help="Path to plain-text file with the full prompt")
    p.add_argument("--out", required=True, help="Output PNG path (e.g. src/assets/pets/_incoming/species_form_sheet.png)")
    p.add_argument("--size", default="1536x1024", help="Image dimensions WxH (default: 1536x1024)")
    p.add_argument("--backend", choices=["oauth", "api"], default="oauth",
                   help="oauth: chatgpt-imagegen (default); api: OpenAI SDK + OPENAI_API_KEY")
    p.add_argument("--ref", default=None,
                   help="Reference image path. Active only with --backend api; silently ignored for oauth.")
    return p


def _chatgpt_oauth(prompt: str, size: str, out: str) -> None:
    exe = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chatgpt-imagegen")
    result = subprocess.run([exe, prompt, "-o", out, "--size", size])
    if result.returncode != 0:
        sys.exit(f"chatgpt-imagegen exited with code {result.returncode}")


def _openai_api(prompt: str, size: str, ref: str | None, out: str) -> None:
    import base64
    import openai
    client = openai.OpenAI()
    if ref:
        with open(ref, "rb") as f:
            resp = client.images.edit(
                model="gpt-image-2",
                image=f,
                prompt=prompt,
                size=size,
                response_format="b64_json",
            )
    else:
        resp = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size=size,
            response_format="b64_json",
        )
    with open(out, "wb") as f:
        f.write(base64.b64decode(resp.data[0].b64_json))


def generate(prompt: str, size: str, ref: str | None, backend: str, out: str) -> None:
    if backend == "oauth":
        _chatgpt_oauth(prompt, size, out)
    elif backend == "api":
        _openai_api(prompt, size, ref, out)
    else:
        sys.exit(f"Unknown backend: {backend}")


def main() -> None:
    args = _build_parser().parse_args()

    with open(args.prompt_file) as f:
        prompt = f.read().strip()

    if not prompt:
        sys.exit(f"Prompt file is empty: {args.prompt_file}")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    print(f"[gen_image] backend={args.backend}  size={args.size}  out={args.out}", flush=True)
    generate(prompt, args.size, args.ref, args.backend, args.out)
    print(f"[gen_image] saved → {args.out}")


if __name__ == "__main__":
    main()
