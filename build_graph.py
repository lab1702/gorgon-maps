#!/usr/bin/env python3
"""Build a zone connection graph for Project Gorgon from wiki data."""

import json
import re
import os

# Raw connection data extracted from wiki MAP infobox "connects" fields
# Format: zone_name -> raw wiki connects string
raw_connections = {
    # Overworld zones
    "Anagoge Island": "[[Serbule]]",
    "Serbule": "[[Eltibule]], [[Sun Vale]], [[Serbule Hills]], [[Anagoge Island]]",
    "Serbule Hills": "[[Serbule]]",
    "Eltibule": "[[Serbule]], [[Kur Mountains]], [[Red Wing Casino]]",
    "Sun Vale": "[[Serbule]], [[Fae Realm]]",
    "Kur Mountains": "[[Eltibule]], [[Ilmari]], [[Gazluk]]",
    "Ilmari": "[[Kur Mountains]], [[Rahu]]",
    "Rahu": "[[Ilmari]], [[Povus]], [[Red Wing Casino]]",
    "Red Wing Casino": "[[Eltibule]], [[Rahu]], [[Statehelm]]",
    "Gazluk": "[[Kur Mountains]], [[Povus]], [[Vidaria]]",
    "Fae Realm": "[[Winter Nexus]]",
    "Povus": "[[Rahu]], [[Gazluk]], [[Vidaria]]",
    "Vidaria": "[[Povus]], [[Gazluk]], [[Statehelm]]",
    "Statehelm": "[[Vidaria]], [[Red Wing Casino]]",
    "Phantom Ilmari Desert": "[[Serbule]]",

    # Dungeons
    "Anagoge Records Facility": "[[Anagoge Island]], [[Serbule Hills Spider Cave]]",
    "Animal Nexus": "[[Eltibule]]",
    "Boarded up Basement": "[[Eltibule]]",
    "Borghild": "[[Serbule]]",
    "Brain Bug Cave": "[[Serbule]]",
    "Carpal Tunnels": "[[Serbule]]",
    "Crystal Cavern": "[[Serbule]]",
    "Dark Chapel": "[[Eltibule]]",
    "Eltibule Crypt": "[[Eltibule]]",
    "Goblin Dungeon": "[[Eltibule]]",
    "Hogan's Basement": "[[Eltibule]]",
    "Kur Tower": "[[Kur Mountains]], [[Necromancer's Courtyard]]",
    "Labyrinth": "[[Ilmari]]",
    "Myconian Cave": "[[Serbule]]",
    "Rahu Sewer": "[[Rahu]]",
    "Ranalon Den": "[[Serbule Hills]]",
    "Serbule Crypt": "[[Serbule]], [[Serbule Sewers]]",
    "Serbule Sewers": "[[Serbule]], [[Serbule Crypt]]",
    "Serbule Hills Spider Cave": "[[Anagoge Records Facility]], [[Serbule Hills]]",
    "The Wintertide": "[[Fae Realm]]",
    "Wolf Cave": "[[Kur Mountains]]",
    "Yeti Cave": "[[Kur Mountains]]",
    "Winter Nexus": "[[Sun Vale]], [[Fae Realm]]",
    "Gazluk Keep": "[[Gazluk]]",
    "Gazluk Shadow Cave": "[[Gazluk]]",
    "No-Name Cave": "[[Gazluk]]",
    "New Prestonbule Cave": "[[Gazluk]]",
    "Snowblood Shadow Cave": "[[Gazluk]]",
    "Windy View Cave": "[[Gazluk]]",
    "Underwater Cave": "[[Sun Vale]], [[Animal Nexus]]",
    "War Caches": "[[Ilmari]]",
    "Aktaari Cave": "[[Errruka's Cave]]",
    "Elven Judgement": "[[Nightmare Caves]]",
    "Errruka's Cave": "[[Povus]], [[Aktaari Cave]], [[Forthragarian Caves]]",
    "Forthragarian Caves": "[[Errruka's Cave]], [[Nightmare Caves]]",
    "Nightmare Caves": "[[Forthragarian Caves]], [[Elven Judgement]]",
    "Fungal Fortress": "[[Povus]]",
    "Necromancer's Courtyard": "[[Kur Tower]]",
    "Fish Bowl Cavern": "[[Sun Vale]]",
    "Sacred Grotto": "[[Kur Mountains]]",
    "Sacrificial Sea Cave": "[[Sun Vale]]",
    "Amaluk Valley Cave": "[[Gazluk]], [[Fae Realm]]",
    "Molybdenum Mine": "[[Sun Vale]]",
    "Warden Cave": "[[Kur Mountains]]",
}

# Map from zone name -> map image filename (from extracted maps)
zone_to_map = {
    "Anagoge Island": "Map_AreaNewbieIsland.png",
    "Serbule": "Map_AreaSerbule.png",
    "Serbule Hills": "Map_AreaSerbule2.png",
    "Eltibule": "Map_AreaEltibule.png",
    "Sun Vale": "Map_AreaSunVale.png",
    "Kur Mountains": "Map_AreaKurMountains.png",
    "Ilmari": "Map_AreaDesert1.png",
    "Rahu": "Map_AreaRahu.png",
    "Red Wing Casino": "Map_AreaCasino.png",
    "Gazluk": "Map_AreaGazluk.png",
    "Fae Realm": "Map_AreaFaeRealm1.png",
    "Povus": "Map_Povus.png",
    "Vidaria": "Map_Vidaria.png",
    "Statehelm": "Map_AreaStatehelm.png",
    "Phantom Ilmari Desert": "Map_AreaDesert1.png",
    "Animal Nexus": "Map_AnimalNexus.png",
    "Boarded up Basement": "Map_BoardedUpBasement.png",
    "Borghild": "Map_Borghild.png",
    "Brain Bug Cave": "Map_BrainBugCave.png",
    "Carpal Tunnels": "Map_CarpalTunnels.png",
    "Crystal Cavern": "Map_CrystalCavern.png",
    "Dark Chapel": "Map_DarkChapel.png",
    "Eltibule Crypt": "Map_EltibuleCrypt.png",
    "Goblin Dungeon": "Map_GoblinDungeon.png",
    "Hogan's Basement": "Map_HogansKeepBasement.png",
    "Kur Tower": "Map_KurTower.png",
    "Labyrinth": "Map_Labyrinth.png",
    "Myconian Cave": "Map_MyconianCave.png",
    "Rahu Sewer": "Map_RahuSewer.png",
    "Ranalon Den": "Map_RanalonBase.png",
    "Serbule Sewers": "Map_SerbuleSewer.png",
    "Wolf Cave": "Map_WolfCave.png",
    "Yeti Cave": "Map_YetiCave.png",
    "Winter Nexus": "Map_WinterNexus.png",
    "No-Name Cave": "Map_NoNameCave.png",
    "New Prestonbule Cave": "Map_NewPrestonbule.png",
    "Snowblood Shadow Cave": "Map_SnowbloodCave.png",
    "Windy View Cave": "Map_WindyViewCave.png",
    "The Wintertide": "Map_TheWintertide.png",
    "Necromancer's Courtyard": "Map_KurCourtyard.png",
    "Khyrulek's Crypt": "Map_KhyruleksCrypt.png",
    "Tower View Cave": "Map_TowerView.png",
    "PvP Arena": "Map_PvPArena.png",
    "Puck Halls": "Map_PuckHalls.png",
    "Warden Cave": "Map_WardenCave.png",
    "Serbule Hills Spider Cave": "Map_SpiderCave.png",
    "Aktaari Cave": "Map_PovusCaves_AktaariCave.png",
    "Elven Judgement": "Map_PovusCaves_ElvenJudgement.png",
    "Errruka's Cave": "Map_PovusCaves_ErrrukasCave.png",
    "Forthragarian Caves": "Map_PovusCaves_ForthragarianCaves.png",
    "Nightmare Caves": "Map_PovusCaves_NightmareCaves.png",
    "Sacrificial Sea Cave": "Map_SunValeCave1.png",
    "Fish Bowl Cavern": "Map_SunValeCave2.png",
    "Molybdenum Mine": "Map_SunValeCave3.png",
    "Sacred Grotto": "Map_SnowbloodCave.png",
    "Statehelm Safehouse": "Map_StatehelmCaves_SafeHouseA.png",
    "Anagoge Records Facility": "Map_NewbieIslandDungeon.png",
    "Amaluk Valley Cave": "Map_TowerView.png",
    "Gazluk Keep": "FortGazluk1.png",
    "Gazluk Shadow Cave": "Map_SnowbloodCave.png",
    "War Caches": "Map_WarCache_Drug-1.png",
}

def parse_connections(raw):
    """Extract zone names from wiki link syntax."""
    return [m.group(1) for m in re.finditer(r'\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]', raw)]


# Build graph
graph = {}
for zone, raw in raw_connections.items():
    connections = parse_connections(raw)
    map_file = zone_to_map.get(zone)
    graph[zone] = {
        "connections": connections,
        "map_file": map_file,
        "type": "overworld" if zone in [
            "Anagoge Island", "Serbule", "Serbule Hills", "Eltibule",
            "Sun Vale", "Kur Mountains", "Ilmari", "Rahu",
            "Red Wing Casino", "Gazluk", "Fae Realm", "Povus",
            "Vidaria", "Statehelm", "Phantom Ilmari Desert"
        ] else "dungeon"
    }

# Write output
output_path = "/home/lab/tmp/gorgon-maps/zone_connections.json"
with open(output_path, "w") as f:
    json.dump(graph, f, indent=2)

print(f"Wrote {len(graph)} zones to {output_path}")
print()

# Print summary
print("=== OVERWORLD ZONE GRAPH ===")
for zone, data in sorted(graph.items()):
    if data["type"] == "overworld":
        conns = ", ".join(data["connections"])
        map_status = "has map" if data["map_file"] else "NO MAP"
        print(f"  {zone} ({map_status}) -> {conns}")

print()
print("=== DUNGEON CONNECTIONS ===")
for zone, data in sorted(graph.items()):
    if data["type"] == "dungeon":
        conns = ", ".join(data["connections"])
        map_status = "has map" if data["map_file"] else "NO MAP"
        print(f"  {zone} ({map_status}) -> {conns}")
