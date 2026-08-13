#!/usr/bin/env python3
"""Download the curated spell effects into assets/spell-effects/.

The pack is GPL-3.0 and 1.09 GB. These 35 are the spells this table
actually casts, each under 3 MB, about 28 MB together. Everything else is
in the index and fetched from the CDN on first use.

The licence and the credits live beside the files this writes; put them
there first. Run from the repository root:  python scripts/fx-fetch.py
"""
import os, sys, urllib.request

COMMIT = "436fa96d7e9e97f8e6116c19c65f495d269f8093"
BASE = f"https://cdn.jsdelivr.net/gh/jackkerouac/animated-spell-effects@{COMMIT}/spell-effects/"
OUT = os.path.join("assets", "spell-effects")

CURATED = [
    "fire/fire_explosion_CIRCLE_01.webm",          # Fireball
    "fire/fire_bolt_RAY_02.webm",                  # Fire Bolt / Scorching Ray
    "fire/fire_breath_CONE_01.webm",               # Burning Hands / dragon breath
    "fire/fire_wall_RAY_01.webm",                  # Wall of Fire
    "fire/fire_ball_rotating_CIRCLE_01.webm",      # Flaming Sphere
    "fire/fire_explosion_SQUARE_01.webm",          # Flame Strike
    "fire/fire_circle_CIRCLE_01.webm",             # Circle of flame
    "lightning/lightning_blast_RAY_02.webm",       # Lightning Bolt
    "lightning/lightning_blast_multicolour_RAY_01.webm",  # Chain Lightning
    "lightning/lightning_slam_RAY_01.webm",        # Call Lightning
    "lightning/lightning_explosion_CIRCLE_01.webm",# Thunderwave / Shatter
    "lightning/lightning_flash_SQUARE_03.webm",    # a flash over a room
    "ice/frost_CONE_01.webm",                      # Cone of Cold
    "ice/frost_beam_RAY_02.webm",                  # Ray of Frost
    "ice/ice_ball_RAY_01.webm",                    # Ice Knife
    "magic/magic_missle_RAY_06.webm",              # Magic Missile
    "energy/energy_beam_RAY_01.webm",              # Eldritch Blast
    "energy/disintegration_beam_RAY_02.webm",      # Disintegrate
    "energy/energy_explosion_CIRCLE_01.webm",      # a force burst
    "energy/energy_shield_CIRCLE_02.webm",         # Shield
    "energy/energy_throw_RAY_01.webm",             # Guiding Bolt
    "air/wind_blast_RAY_01.webm",                  # Gust of Wind
    "air/smoke_explosion_CIRCLE_01.webm",          # Fog Cloud / Stinking Cloud
    "air/dust_blast_CONE_01.webm",                 # Cloudkill
    "earth/earth-cracks_SQUARE_01.webm",           # Earthquake
    "earth/earth-hole_RECTANGLE_01.webm",          # a pit
    "magic/magic_shockwave_CIRCLE_01.webm",        # Counterspell
    "misc/runes_four_CIRCLE_01.webm",              # Teleport
    "misc/runes_CIRCLE_02.webm",                   # a summoning circle
    "misc/lathander_symbol_CIRCLE_01.webm",        # Sacred Flame
    "magic/magic_wild_CIRCLE_01.webm",             # Wild Magic
    "magic/magic_dust_SQUARE_03.webm",             # Sleep
    "magic/magic_forcefield_SQUARE_01.webm",       # Wall of Force
    "water/water_blast_RAY_01.webm",               # Tidal Wave
    "misc/skull_blast_CIRCLE_01.webm",             # Blight
]

LIMIT_KB = 3072


def main():
    total = 0
    for rel in CURATED:
        dest = os.path.join(OUT, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if os.path.exists(dest):
            total += os.path.getsize(dest)
            print(f"  have  {rel}")
            continue
        req = urllib.request.Request(BASE + rel, headers={"User-Agent": "wazoo-fx-fetch"})
        with urllib.request.urlopen(req) as r:
            data = r.read()
        kb = len(data) // 1024
        if kb > LIMIT_KB:
            print(f"ERROR: {rel} is {kb} KB, over the {LIMIT_KB} KB limit", file=sys.stderr)
            return 1
        with open(dest, "wb") as f:
            f.write(data)
        total += len(data)
        print(f"  got   {rel}  ({kb} KB)")
    print(f"{len(CURATED)} effects, {total // 1024 // 1024} MB in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
