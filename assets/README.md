# Art & Sound Brief: *Abandoned but not Forgotten - The Last Transmission*

Everything the game draws or plays has a slot in `src/assets.js`. Put files under `Artwork/` with the exact names below and they replace the placeholder automatically; nothing else needs to change. Missing files show as labeled colored boxes of the right size, so the game is always playable.

## Canvas and style
- Logical canvas: **320x180 px** (16:9), integer-scaled with crisp pixels. Every scene is one screen. Design at 1:1 and check at 3x/4x.
- Format: PNG with transparency (RGBA). No anti-aliased edges on sprites; backgrounds can use any palette.
- Pixel scale: the astronaut sprite is 24x24 = a 2 m suited astronaut, so **12 px per metre**. Rovers are drawn at **about 2x true scale** so they are readable (the LRV would be ~37x14 px at true scale; draw it ~74x28). Archivist pages state the real sizes.
- Palettes: Hub cyan-white, deep navy `#0b3d91`, slate gray. Moon cool monochrome grays, silver regolith, jet-black shadows. Mars ochre, rust-orange `#fc3d21`, dusty brown.
- Sprite sheets are strips: frames side by side ("h") or stacked ("v"), each frame exactly the listed size.

## Astronaut (already delivered)
| Slot | File | Size |
|---|---|---|
| `astro_front` | `Artwork/Sprites/Astronaut/astronaut_front.png` | 24x24 |
| `astro_back` | `Artwork/Sprites/Astronaut/astronaut_back.png` | 24x24 |
| `astro_left` | `Artwork/Sprites/Astronaut/astronaut_left.png` | 24x24 |
| `astro_right` | `Artwork/Sprites/Astronaut/astronaut_right.png` | 24x24 |

One frame per facing. Walking bob, the low-gravity hop, and the ground shadow are animated in code. The feet occupy roughly the bottom 8 px, centered.

## Scenes (320x180 backgrounds)
| Slot | File | Notes |
|---|---|---|
| `scene_hub` | `Artwork/Scenes/hub.png` | Orbital observation room. Layout: Star Map top-left, Portal pad top-center, Archive Computer top-right, Notebook desk bottom-left, Expansion Bay crates bottom-right (sealed "coming soon" crates, decorative). Leave a clear floor area of at least 200x80 px in the middle. Wooden floor. |
| `scene_moon` | `Artwork/Scenes/moon_taurus_littrow.png` | Taurus-Littrow valley, black sky, LRV parked (it may be painted in; see rover notes), a return pad, a floating blueprint chip spot, and 1-2 crater shadow areas that the headlamp reveals. Leave walkable regolith around every object (the astronaut must reach each one). |
| `scene_mars` | `Artwork/Scenes/mars_ares_vallis.png` | Ares Vallis, ochre sky, rocks "Barnacle Bill" and "Yogi", the Pathfinder lander with its ramps (optional, can also be the `pathfinder_lander` sprite). **Do not paint Sojourner into the background**; it is a sprite so it can drive. |

Interactable objects are painted into the scene. The data team marks their rectangles in code (hotspots and collision), so after delivering a scene please also give a quick list of where each object sits (x, y, width, height in px) or a copy of the image with boxes drawn on it.

## Title screen
| Slot | File | Size | Frames |
|---|---|---|---|
| `title_bg` | `Artwork/UI/title_bg.png` | 320x180 | 1 |
| `title_logo` | `Artwork/UI/title_logo.png` | 240x64 | 1 (optional if the logo is in the background) |
| `btn_continue` | `Artwork/UI/btn_continue.png` | 96x18 | 3 stacked vertically: normal, focused, pressed |
| `btn_new_game` | `Artwork/UI/btn_new_game.png` | 96x18 | 3 stacked vertically |
| `btn_mode_explorer` | `Artwork/UI/btn_mode_explorer.png` | 96x18 | 3 stacked vertically |
| `btn_mode_archivist` | `Artwork/UI/btn_mode_archivist.png` | 96x18 | 3 stacked vertically |
| `btn_mode_selected` | `Artwork/UI/btn_mode_selected.png` | 96x18 | 1, a highlight frame drawn over the chosen mode button |

Behavior is coded: Continue appears only when a save exists; New Game; a mode picker (Explorer ages 9-12 / Archivist ages 13-18). Leave the lower third of the background relatively calm for the buttons.

## Robots and hardware
| Slot | File | Size | Frames | Notes |
|---|---|---|---|---|
| `portrait_lrv` | `Artwork/Sprites/Robots/lrv_portrait.png` | 48x48 | 2 side by side | idle, talking (e.g. camera light blink) |
| `portrait_sojourner` | `Artwork/Sprites/Robots/sojourner_portrait.png` | 48x48 | 2 side by side | idle, talking |
| `lrv_gcta` | `Artwork/Sprites/Robots/lrv_gcta.png` | 12x12 | 8 side by side | LRV TV camera head, 8 pan directions 45 degrees apart, starting facing right. Drawn over the painted LRV so it can pan. |
| `lrv_wheel` | `Artwork/Sprites/Robots/lrv_wheel.png` | 12x12 | 4 side by side | wire-mesh wheel rotating (fender demo) |
| `lrv_fender` | `Artwork/Sprites/Robots/lrv_fender.png` | 16x8 | 2 side by side | original fender, taped-map repair |
| `sojourner_body` | `Artwork/Sprites/Robots/sojourner.png` | 24x14 | 2 side by side | level, and tilted with the rocker-bogie climbing a rock; facing right (code flips it) |
| `sojourner_apxs` | `Artwork/Sprites/Robots/sojourner_apxs.png` | 8x8 | 2 side by side | APXS head stowed, deployed |
| `pathfinder_lander` | `Artwork/Sprites/Robots/pathfinder_lander.png` | 48x28 | 1 | optional if painted into the Mars scene |

## Blueprint schematics
| Slot | File | Size |
|---|---|---|
| `schematic_lrv` | `Artwork/Blueprints/lrv_schematic.png` | 160x100, white/cyan wireframe on transparent |
| `schematic_sojourner` | `Artwork/Blueprints/sojourner_schematic.png` | 160x100, same style |

The UI draws them on a dark blueprint grid, so leave the background transparent.

## Hub station highlights (optional)
If the stations are painted into `hub.png`, these 2-frame overlays (idle, active glow) are drawn on top when the player is near. Skip them if the painted stations already read clearly.

| Slot | File | Size |
|---|---|---|
| `station_star_map` | `Artwork/Scenes/hub_stations/star_map.png` | 32x32 x2 |
| `station_portal` | `Artwork/Scenes/hub_stations/portal.png` | 40x24 x2 |
| `station_computer` | `Artwork/Scenes/hub_stations/computer.png` | 32x32 x2 |
| `station_notebook` | `Artwork/Scenes/hub_stations/notebook.png` | 24x24 x2 |
| `station_expansion_bay` | `Artwork/Scenes/hub_stations/expansion_bay.png` | 48x32 x1 |

## Pickups and effects
| Slot | File | Size | Frames |
|---|---|---|---|
| `blueprint_pickup` | `Artwork/Sprites/FX/blueprint_pickup.png` | 12x12 | 4 (bob / glint) |
| `return_pad` | `Artwork/Sprites/FX/return_pad.png` | 24x12 | 2 (pulse) |
| `fx_scan` | `Artwork/Sprites/FX/scan.png` | 16x16 | 4 |
| `fx_alert` | `Artwork/Sprites/FX/alert.png` | 8x8 | 2 (the floating `[!]`) |
| `fx_dust` | `Artwork/Sprites/FX/dust.png` | 3x3 | 1 (optional; dust can be procedural) |
| `hud_icons` | `Artwork/UI/hud_icons.png` | 10x10 | 6: blueprint, notebook, headlamp, mute, explorer, archivist |

## Catalog icons (16x16 each, `Artwork/Icons/`)
`surveyor3.png`, `apollo_lm_descent.png`, `alsep.png`, `pathfinder_airbags.png`, `insight_seis.png`, `ingenuity.png`, `near_shoemaker.png`, `voyager1.png`.

## Ending montage (320x180 each, `Artwork/Montage/`)
- `lrv_taurus_littrow.png`: the LRV parked, camera pointed at the empty LM descent stage, Earth in the black sky.
- `sojourner_beside_pathfinder.png`: Sojourner at rest beside the Pathfinder lander, dust on its solar panel.

## Sound (optional, `Artwork/Audio/*.ogg`)
Every sound is synthesized in code. A file with one of these names replaces the synthesized version: `step_wood`, `step_sand`, `step_suit`, `breath` (loop), `talk_lrv`, `talk_soj`, `confirm`, `cancel`, `cursor`, `scan`, `blueprint_get`, `station_computer`, `station_starmap`, `notebook`, `portal`, `return_pad`, `fact`, `headlamp`, `signal_tick`, `signal_done`, `prop_open`, `prop_action`, `pause`, `ending` (loop). Keep one-shots under 0.5 s, mono, 44.1 kHz.

Footsteps are surface-specific on purpose: wooden in the Hub, sandy on Mars, and on the Moon a muffled thump plus breathing, because there is no air to carry sound outside the suit.
