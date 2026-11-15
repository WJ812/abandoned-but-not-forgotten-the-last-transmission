# Bug Fix Log

This file records the bugs found by testing *Abandoned but not Forgotten - The Last Transmission*, and how each one was fixed.

**Testing done**
- Automated unit tests: run with `npm test`.
- Fuzz and stress testing of the engine, which drives the game with random input:
  - over 120,000 random frames per scene;
  - over 200,000 random actions on the hardware props;
  - save-data corruption tests.
- Headless-browser checks of every screen.

Severity: **High** means the game breaks or progress is lost. **Medium** means a feature stops working or the game state becomes wrong. **Low** is an edge case or a cosmetic problem.

## 2026-11-14: Stress test, round 1

No high-severity bugs were found.

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 1 | Medium | Mars / Sojourner drive | A drive target on the Pathfinder lander made Sojourner park inside the lander. Its talk spot then sat inside a solid, and the conversation was out of reach for the rest of the session. | Drive planning now avoids every solid in the scene, including the lander. Targets are clamped to the walkable area, and the rover's position is checked at each step of its move. The lander was also added to the rover's obstacle list. | `d2fee7a`, `fde9c12` |
| 2 | Medium | Mars / Sojourner prompts | The "Solar panel" and "Hazard lasers" prompts stayed where the rover started after it drove away. Their areas only touched the rover's area edge to edge, so they weren't moved with it. | Hotspots that belong to the rover are now listed explicitly instead of being found by overlap. | `d2fee7a` |
| 3 | Medium | Save system | (a) When the browser refused to write to storage (Safari private mode, or full storage), **Continue** stayed hidden. (b) Once storage filled up after an earlier save, **Continue** reloaded that older save and silently threw away newer progress. | The in-memory save copy is now written first and takes priority over browser storage for the rest of the session. Erasing a save also holds for the session. | `d2fee7a` |
| 4 | Low | Mars signal bar | A time step of NaN (not a number) stopped the "SIGNAL ~11 min" bar from ever finishing. | The engine now cleans every time step: an invalid or negative value becomes 0, and the largest allowed step is 0.25 s. | `d2fee7a` |
| 5 | Low | LRV camera / fender | An infinite time step got past the input check. The fender angle became invalid, and camera commands stopped waiting for the 1.3 s Earth-Moon delay. | Same time-step cleanup as #4. | `d2fee7a` |
| 6 | Low | Sojourner drive | One very large time step could move the rover straight through a rock. | Rover movement is broken into steps of at most 2 px, and each step is checked for collisions. | `d2fee7a` |
| 7 | Low | Drive panel controls | The arrow keys aimed the cursor, so W/S never reached the menu. Stop only worked with the 2 key, and the on-screen key hints were wrong. | Controls are consistent, and every panel's key hints now match what the keys do. | `fde9c12` |
| 8 | Low | Fact pop-ups | When a fact pop-up and the return pad triggered on the same frame, the return pad was ignored. | The pad or portal event is remembered and runs when the pop-up closes. | `fde9c12` |
| 9 | Low | Dialogue | Esc did nothing outside the question menu. | Esc now skips to the question menu from any page, and leaves the conversation from the goodbye page. | `fde9c12` |
| 10 | Low | Startup message | The fallback message mentioned `?mock=1` even when the player hadn't asked for test mode. | Test mode and the automatic fallback now each show their own message. | `fde9c12` |
| 11 | Low | Prop panels | Bad or incomplete hardware data could crash a panel. | Hardware data is checked and filled in before use, and each panel's drawing is protected against errors. | `fde9c12` |

## Found during integration

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 12 | Medium | Mars | The Pathfinder lander blocked movement but was never drawn when the scene art was real, which made it an **invisible wall**. | The lander is always drawn, using a placeholder until its sprite exists. | `dcb4c37` |
| 13 | Low | Tests | On Windows with Node 22, `npm test` treated each test folder as a single program instead of searching it for test files, so some tests never ran. | The test script now matches `src/**/*.test.js` directly. | `0827a97` |
| 14 | Low | HUD | The placeholder letters "E" and "S" on the HUD buttons looked like keyboard shortcuts. S is also the "move down" key. | They were replaced with symbols: ◎/◆ for the mode and ♪/✕ for sound. | `208fce4` |

## Verified behavior (no bug found)

- **Collision:** no tunneling. The player stops exactly at a 1 px wall, even when moving 70 px per frame. Hopping on the Moon or Mars never carries the player over or into solid objects.
- **Physics:** Moon hops reach 8.33 px and Mars hops 3.63 px, a ratio of 2.30, which matches the real gravity ratio of 3.72 / 1.62. Heights stay the same over thousands of hops.
- **Portal and return pad:** they never trigger again while the player stands on them, and never on the frame the player arrives. This held across 1,000 region switches.
- **Saves:** corrupted, wrong-version, empty, very large, and `__proto__`-poisoned save data never crashes the game.
- **Performance:** a frame takes 1 to 7 µs, against a budget of 16.7 ms.

## 2026-11-14: Fact checks against NASA sources

Two rounds of checks compared every number in the game with NASA, NSSDCA, JPL and *Apollo Lunar Surface Journal* sources.

| # | Area | Issue | Fix | Commit |
|---|---|---|---|---|
| 15 | LRV distance | The total said 35.9 km, but the three moonwalk drives add up to 35.7 km. | Changed to about 35.7 km everywhere, matching NASA's 35.74 km. The Archivist page notes that published totals vary slightly. | `9e84ba7` |
| 16 | APXS rock chemistry | The Barnacle Bill and Yogi values didn't match NASA's published APXS table. | Replaced with the NSSDCA preliminary values. Yogi is marked as dust-affected. | `9e84ba7` |
| 17 | Sojourner's last contact | "Last contact, 27 Sep 1997" was stated as final. That was actually the last *full* transmission: faint signals continued until 7 Oct, and the mission ended 4 Nov. | Reworded throughout. The contingency-mode wording is hedged. | `9e84ba7` |
| 18 | Smaller details | The hazard scan range, the EVA-1 and EVA-3 ranges, and Barnacle Bill's sol were unconfirmed. | The scan range is now about 20 cm. The unconfirmed values are marked approximate. | `9e84ba7` |
| 19 | Details that couldn't be verified | The TV camera's pan and tilt limits, the operator's name, Twin Peaks, Big Crater, the fender maps, Sojourner's mass, and the distance to Surveyor 3. | Worded as "about" or "reported", or reduced to what sources confirm. | `6e97db7` |

## 2026-11-14: Keyboard playthrough in a real browser (round 1)

The full game was played from the title screen to the ending using only key input. Every step passed, and no console errors appeared.

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 20 | Medium | Dialogue | While an answer typed out, and during the SIGNAL bar, the key hint was out of date, and Esc did something different from what it said. | The hint now follows the dialogue's state. | `98d20d3` |
| 21 | Medium | Archive Computer | The "Recap" tab blinked fully invisible, which hid the ending. | It now glows steadily instead of disappearing. | `98d20d3` |
| 22 | Medium | Mars | The player froze once and could not move. This was not reproduced. | Input is reset on every return to the world, and a guard moves the astronaut free if it is ever wedged inside a solid. | `98d20d3` |
| 23 | Low | Star Map | Its content overflowed the screen and hid the info panel. | Reorganized into a side-by-side layout with no scrolling. | `98d20d3` |
| 24 | Low | Hardware panels | Long text was cut off, and labels on the drive log and battery chart overlapped. | Long text wraps, the labels are staggered, and the chart tooltip moved clear of the other labels. | `98d20d3` |
| 25 | Low | Replays | Pressing Space selected the EVA instead of starting the replay. | Play is now the default control. | `98d20d3` |
| 26 | Low | Usability | The walkway under Sojourner was only 10 px wide. The world prompt showed "E" while every other hint said "Space". | The walkway is now 18 px, and the prompt says "Space". | `16a271e` |
| 27 | Low | Moon | Crater shadows were drawn as rectangles over round craters. | They are now drawn as ellipses that match the crater floors. | `d640ca2` |

## 2026-11-15: Pixel-art stand-ins

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 28 | Medium | Stand-ins / Sojourner screen | With the first version of the stand-ins, the keyboard playthrough failed on Mars: the player could not leave the Sojourner screen. The cause, found by applying the changes one file at a time, was a change that drew rocks on the drive-log map. It also placed the rocks in the wrong coordinate space. | That change was left out. The remaining stand-ins pass the 46-step playthrough twice in a row. An attempted anti-freeze "nudge" workaround was also left out, because it made the player jitter against walls. | `3b0ef4f` |
| 29 | Info | Test harness | **Correction to #22 and #28.** The intermittent "player froze on Mars" failures did not come from the game. During long automated runs, Edge on Windows decided the headless browser window was covered and stopped drawing it, which froze the game's frame loop at random moments. Measured in a normal window, the game runs at a steady 60 fps on every scene, and 20 cycles through every screen showed no slowdown and no memory leak. | The test launches Edge with occlusion detection and background throttling turned off, and passes 46/46 three times in a row with zero frozen frames. The drive-log rocks (now placed in the map's own coordinates by the data) were restored. | this commit |

## 2026-11-15: Player feedback round

| # | Severity | Area | Bug | Fix | Commit |
|---|---|---|---|---|---|
| 30 | Medium | Layout | On some window sizes, the rover dialogue box ran off the bottom of the screen. | The canvas and every HUD and dialogue overlay now scale together to fit the window. Integer scaling is used when it fits, smooth scaling otherwise. | `ecb0570` |
| 31 | Low | Rover screens | Dialogue text was drawn under the name tab and was partly hidden. A text-only "LANDER" box showed in the hazard panel. | The text now sits inside the box, beside the rover portrait, and the hazard panel draws the lander sprite. | `62351f4` |
| 32 | Medium | Notebook | In the Moon vs Mars table, the Mars column was shifted one row: temperature showed the air pressure. | Rows are now matched by key. A proper Air pressure row and the average distance to Mars were added. | `4056bea` |
| 33 | Low | Ending | The recap screen showed no rovers, and the montage faded in too slowly to see them. | The rover sprites now appear on the recap screen, and the montage reaches full brightness quickly. | `d8f5df8` |
| 34 | Low | Usability | The goal wasn't obvious to young players. | Added an objective line in the HUD, an "OBJECTIVE COMPLETE" banner after the second blueprint, and a "Recap ready!" prompt at the computer. | `d8f5df8` |
