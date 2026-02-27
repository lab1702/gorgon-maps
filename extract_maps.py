#!/usr/bin/env python3
"""Extract map images from Project Gorgon Unity asset bundles."""

import os
import UnityPy

BUNDLE_DIR = os.path.expanduser(
    "~/snap/steam/common/.local/share/Steam/steamapps/common/"
    "Project Gorgon/ProjectGorgon_Data/StreamingAssets/aa/StandaloneLinux64"
)
OUTPUT_DIR = "/home/lab/tmp/gorgon-maps/maps"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Find all map bundles
bundles = sorted(f for f in os.listdir(BUNDLE_DIR) if f.startswith("maps_"))

print(f"Found {len(bundles)} map bundles")

extracted = 0
for bundle_name in bundles:
    bundle_path = os.path.join(BUNDLE_DIR, bundle_name)
    env = UnityPy.load(bundle_path)

    for obj in env.objects:
        if obj.type.name == "Texture2D":
            data = obj.read()
            name = data.m_Name
            img = data.image
            out_path = os.path.join(OUTPUT_DIR, f"{name}.png")
            img.save(out_path)
            print(f"  {name}.png ({img.size[0]}x{img.size[1]})")
            extracted += 1
        elif obj.type.name == "Sprite":
            data = obj.read()
            name = data.m_Name
            img = data.image
            out_path = os.path.join(OUTPUT_DIR, f"{name}.png")
            img.save(out_path)
            print(f"  {name}.png (sprite, {img.size[0]}x{img.size[1]})")
            extracted += 1

print(f"\nExtracted {extracted} images to {OUTPUT_DIR}")
