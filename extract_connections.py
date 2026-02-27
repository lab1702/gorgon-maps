#!/usr/bin/env python3
"""Extract zone connections from Project Gorgon Unity scene files.

Scans all level files for GameObjects with portal/entrance/exit names,
and MonoBehaviours that reference destination areas.
"""

import UnityPy
import json
import re
import os
from collections import defaultdict

DATA_DIR = '/home/lab/snap/steam/common/.local/share/Steam/steamapps/common/Project Gorgon/ProjectGorgon_Data'

# First pass: identify what each level file is (zone name)
# by looking at AreaConfig or other identifying objects
zone_info = {}
all_portal_objects = defaultdict(list)

for level_num in range(0, 44):
    path = os.path.join(DATA_DIR, f'level{level_num}')
    if not os.path.exists(path):
        continue

    try:
        env = UnityPy.load(path)
    except Exception as e:
        print(f"level{level_num}: failed to load - {e}")
        continue

    go_names = []
    monobehaviours = []

    for obj in env.objects:
        if obj.type.name == 'GameObject':
            data = obj.read()
            go_names.append(data.m_Name)
        elif obj.type.name == 'MonoBehaviour':
            try:
                data = obj.read()
                # Try to read the raw tree for data inspection
                tree = obj.read_typetree()
                monobehaviours.append(tree)
            except Exception:
                pass

    # Look for portal-related GameObjects
    portal_keywords = ['portal', 'exit', 'entrance', 'door_to', 'from', 'arrive', 'teleport', 'travel_portal', 'warp']
    zone_keywords = ['serbule', 'eltibule', 'kur', 'casino', 'sun', 'rahu', 'ilmari', 'gazluk',
                     'mycona', 'anagoge', 'newbie', 'povus', 'fae', 'desert', 'statehelm',
                     'cave', 'dungeon', 'crypt', 'sewer', 'labyrinth', 'prestonbule', 'vidaria']

    portal_names = []
    for name in go_names:
        low = name.lower()
        if any(kw in low for kw in portal_keywords):
            portal_names.append(name)

    all_portal_objects[level_num] = portal_names

    # Search MonoBehaviours for area/scene references
    area_refs = []
    for tree in monobehaviours:
        if isinstance(tree, dict):
            tree_str = json.dumps(tree, default=str)
            # Look for area name references
            for kw in zone_keywords:
                if kw in tree_str.lower():
                    # Find the actual field values
                    for key, val in tree.items():
                        if isinstance(val, str) and any(k in val.lower() for k in zone_keywords):
                            area_refs.append((key, val))

    zone_info[level_num] = {
        'total_gameobjects': len(go_names),
        'portal_objects': portal_names,
        'area_references': list(set(area_refs))
    }

# Print summary
print("=" * 80)
print("ZONE CONNECTION DATA FROM SCENE FILES")
print("=" * 80)

for level_num in sorted(zone_info.keys()):
    info = zone_info[level_num]
    if info['portal_objects'] or info['area_references']:
        print(f"\nlevel{level_num} ({info['total_gameobjects']} GameObjects):")
        if info['portal_objects']:
            # Filter to most interesting portal names (those mentioning destinations)
            dest_portals = [p for p in info['portal_objects']
                          if any(kw in p.lower() for kw in zone_keywords + ['to_', 'to ', 'from_', 'from '])]
            other_portals = [p for p in info['portal_objects'] if p not in dest_portals]
            if dest_portals:
                print(f"  Destination portals: {dest_portals}")
            if other_portals:
                print(f"  Other portals: {other_portals}")
        if info['area_references']:
            print(f"  Area refs in MonoBehaviours: {info['area_references'][:10]}")
