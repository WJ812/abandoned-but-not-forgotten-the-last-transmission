# Known Issues & Expected Bugs

These are open issues, deliberate limitations, and areas where bugs are likely in *Abandoned but not Forgotten - The Last Transmission*. Fixed bugs are listed in [BUGFIXES.md](BUGFIXES.md).

## Open: in progress

| Area | Issue | Status |
|---|---|---|
| Art | Missing art shows simple pixel-art stand-ins drawn in code until the real art is supplied; the real files replace them automatically. Slots still waiting on art: the Pathfinder lander, return pads, the blueprint pickup, the LRV fender close-up, robot portraits, the title screen and buttons, HUD icons, the ending montage frames, and catalog icons. | Waiting on art |
| Drive-log map | Sojourner's 1997 drive-log mini-map doesn't draw the nearby rocks. The route is traced on its own map scale, so the rocks need their own map coordinates; projecting the scene's rocks onto it would misplace them. | Open (cosmetic) |
| Translation | The game is English only. French and Arabic are planned after the hackathon. | Planned |

**Recently added:** the automatic Notes journal (opened from the HUD or the computer, with a download that happens only on click), the objective line and completion banner, and window-fitting scaling. The automated playthrough doesn't cover these yet.

**Verified so far:** the full keyboard playthrough (title, Moon, Mars, Archive Computer, ending, reload) passes all 46 steps. The 78 automated tests and four stress scripts pass. The stress scripts include more than 200,000 random hardware actions and more than 240,000 frames of random play.

## Expected bugs: areas to test closely

- **Hotspot alignment with painted art.** Clickable and solid areas are measured by hand from each scene image. Any repaint or resize of a scene can leave invisible walls, or prompts that sit off from the object they belong to.
- **Fact pop-up timing.** A fact zone you walk through while another pop-up is still open does not trigger on that visit. Since the pop-up pauses the game this is mostly theoretical, but quick inputs could hit it.
- **Several triggers on one frame.** A return-pad or portal event that fires on the same frame as a fact is queued until the pop-up closes. Other simultaneous combinations haven't been tested exhaustively.
- **Audio start-up.** Browsers block sound until the first key press or click, so the very first sound effect may be silent.
- **Window scaling.** The whole game scales to fit the window, using smooth (non-integer) scaling when whole-number scaling doesn't fit. In that case pixel art and text can look slightly soft.

## Deliberate limitations (by design)

- **Desktop only.** Keyboard controls only: WASD or the arrow keys, Space, E, N, P, and F. There is no touch or gamepad support.
- **The LRV can't be driven.** Its batteries read 0%, as they really do. During the nav-console replay, the battery gauge shows the 1972 charge from that point in the drive. That is intentional, and the battery graph explains it.
- **Estimated values are labeled.**
  - The LRV's charge after each EVA, and the date its battery ran out, are estimates. They are drawn as dashed lines on the graph.
  - The APXS rock compositions are rounded.
  - The traverse routes on the mini-maps are traced shapes, not surveyed paths.
- **Scaled for gameplay.**
  - Game time runs 2.5x faster than real time.
  - Rovers are drawn at hero scale, larger than true size.
  - The hazard-laser range is enlarged so it can reach the rocks on screen.
  - The Mars signal delay of about 11 minutes is shown as a 2-second bar.
- **Saving.** Progress is saved in the browser. In private mode, or when storage is full, it lasts only for the current session. The mute setting isn't saved.

## Repository note

- The git history was cleaned on 2026-11-15, and local development configuration files no longer appear in any commit.
