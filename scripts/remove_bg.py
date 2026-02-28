#!/usr/bin/env python3
"""Batch-remove image backgrounds using rembg."""

import argparse
from pathlib import Path
from typing import Iterable

from rembg import remove


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove backgrounds from PNG sprites.")
    parser.add_argument(
        "ids",
        nargs="*",
        help="Optional sprite ids (without .png) to process. If omitted, uses --pattern under input_dir.",
    )
    parser.add_argument(
        "--input-dir",
        default="outputs",
        type=Path,
        help="Directory containing source PNGs (default: outputs).",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        type=Path,
        help="Optional output directory. If omitted and --overwrite is not set, defaults to <input-dir>/no_bg.",
    )
    parser.add_argument(
        "--pattern",
        default="*.png",
        help="Glob pattern to find source files when ids are not provided (default: *.png).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Write results directly into input directory using the same filename.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip files that already exist in the output directory.",
    )
    return parser.parse_args()


def gather_sources(input_dir: Path, ids: list[str], pattern: str) -> Iterable[Path]:
    if ids:
        for sprite_id in ids:
            path = input_dir / f"{sprite_id}.png"
            if not path.is_file():
                print(f"Skipping missing: {path}")
                continue
            yield path
        return

    yield from sorted(input_dir.glob(pattern))


def main() -> None:
    args = parse_args()

    input_dir = args.input_dir
    if not input_dir.is_dir():
        raise SystemExit(f"Input directory not found: {input_dir}")

    output_dir = args.input_dir if args.overwrite else (args.output_dir or (args.input_dir / "no_bg"))
    if not args.overwrite:
        output_dir.mkdir(parents=True, exist_ok=True)

    sources = list(gather_sources(args.input_dir, args.ids, args.pattern))
    if not sources:
        raise SystemExit("No source files to process.")

    total = len(sources)
    for index, source_path in enumerate(sources, start=1):
        output_path = source_path if args.overwrite else output_dir / source_path.name
        if args.skip_existing and output_path.exists():
            print(f"[{index}/{total}] Skip: {source_path.name}")
            continue

        print(f"[{index}/{total}] Processing: {source_path.name}")
        with source_path.open("rb") as source_file:
            raw = source_file.read()
        cleaned = remove(raw)
        output_path.write_bytes(cleaned)

    print(f"Done. Processed {total} file(s).")


if __name__ == "__main__":
    main()
