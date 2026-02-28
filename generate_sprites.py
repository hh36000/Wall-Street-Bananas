import json
import sys
import os
import importlib
from concurrent.futures import ThreadPoolExecutor, as_completed

gemini_nano = importlib.import_module("gemini-nano")
generate = gemini_nano.generate

MAX_WORKERS = 5

def generate_sprite(sprite, index, total):
    name = sprite["id"]
    print(f"[{index}/{total}] Generating {name}...")
    generate(
        prompt=sprite["prompt"],
        aspect_ratio="1:1",
        image_size="512x512",
        file_name=name,
    )
    print(f"  Done: {name}")
    return name

def main():
    with open("sprites.json") as f:
        data = json.load(f)

    sprites = data["sprites"]

    # Optional: pass sprite IDs as args to generate only specific ones
    if len(sys.argv) > 1:
        ids = set(sys.argv[1:])
        sprites = [s for s in sprites if s["id"] in ids]
        if not sprites:
            print(f"No matching sprites found for: {', '.join(ids)}")
            return

    os.makedirs("outputs", exist_ok=True)

    total = len(sprites)
    print(f"Generating {total} sprites with {MAX_WORKERS} workers...\n")

    failed = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(generate_sprite, sprite, i + 1, total): sprite
            for i, sprite in enumerate(sprites)
        }
        for future in as_completed(futures):
            sprite = futures[future]
            try:
                future.result()
            except Exception as e:
                print(f"  FAILED: {sprite['id']} - {e}")
                failed.append(sprite["id"])

    print(f"\nFinished. {total - len(failed)}/{total} succeeded.")
    if failed:
        print(f"Failed: {', '.join(failed)}")

if __name__ == "__main__":
    main()
