# Game Design Specification: Abandoned but not Forgotten - The Last Transmission (Web Edition)

## 1. Document Metadata & Technical Target

* **Project Name:** *Abandoned but not Forgotten - The Last Transmission*
* **Submission Framework:** NASA Space Apps Challenge Beirut 2026
* **Team:** Walid Joujou (International College, DP1) & Karma Mardirian (Collège de la Sagesse, Terminale)
* **Target Audience:** Youth aged 9–18 (Middle School through High School STEM learners)
* **Target Platform:** Native Web Application (HTML5 Canvas 2D, CSS3, Vanilla ES6 JavaScript, Web Audio API, `LocalStorage`) — zero installations, zero emulators, playable in any modern desktop browser (keyboard-driven; mobile is out of scope).
* **Release Scope:**
  * **Core Playable Launch Missions (2):** **Lunar Roving Vehicle (LRV)** on the Moon (*Taurus-Littrow*) and **Sojourner Rover** on Mars (*Ares Vallis*).
  * **Modular Expansion Roadmap (3 Packs):** Planned post-hackathon expansions cataloged in the Hub Archive Computer (Lunar Expansion: *Surveyor 3, Apollo LM, ALSEP*; Mars Expansion: *Pathfinder Airbags, InSight, Ingenuity*; Deep Space Expansion: *NEAR Shoemaker, Voyager 1*).
* **Tone & Theme:** Reflective, inspiring, scientifically grounded, and reverent. *"They remain abandoned on other worlds, but never forgotten."*
* **"The Last Transmission":** Each rover tells its final story. Every conversation is framed as that rover's last transmission: its memories of the mission, told to the Archivist before it falls silent for good.

## 2. Display, Controls & Audio Architecture

### 2.1 Viewport & Retro Pixel-Art Style

* **Native Canvas Resolution:** Crisp pixel-art canvas at a `320×180` (16:9) internal logical resolution, integer-scaled with `image-rendering: pixelated` to fill the browser window. Each scene is a single 320×180 screen.
* **Rover Scale:** Rovers are drawn at about 2× true scale next to the astronaut so they are readable and interactable. Archivist pages state their real dimensions.
* **Regional Color Palettes:**
  * **NASA Archives Hub:** Crisp cyan-white, deep navy (`#0b3d91`), and slate gray
  * **The Moon (Taurus-Littrow):** Cool monochrome grays, silver regolith, and stark jet-black crater shadows
  * **Mars (Ares Vallis):** Ochre, rust-orange (`#fc3d21`), and dusty brown
* **Multi-Sensory Retro Feedback:** Synthesized Web Audio API sound, with a mute toggle:
  * **Talk blips** while rovers speak.
  * **Short interaction effects** for specific items: Archive Computer, Star Map, Portal, blueprint scans.
  * **Surface-specific footsteps:** wooden in the Hub, sandy on Mars, and a muffled suit thump with breathing on the Moon, because there is no air to carry sound outside the suit.

  The sound is paired with **visual telemetry indicators** (screen-edge flashes, animated equalizer waveform bars, floating `[!]` icons, and blinking CRT cursors) so the game works seamlessly in muted classrooms.

### 2.2 Desktop Keyboard Controls

| In-Game Action | Primary Keys | Secondary | In-Game Response |
| :--- | :--- | :--- | :--- |
| **4-Way Movement** | **`W A S D`** | Arrow Keys | Moves the astronaut across the terrain with region-specific planetary gravity. |
| **Interact / Confirm** | **`Space`** or **`Enter`** | **`E`** | Talks to rovers, scans blueprints, uses Hub consoles, and advances dialogue. |
| **Explorer Notebook** | **`N`** | **`B`** | Opens/closes the Notebook overlay (checklist, physics comparison, and completion %). |
| **Pause Menu** | **`P`** or **`Esc`** | Top HUD Mode Button (mouse) | `P`/`Esc` pauses and opens a menu: Resume, **Explorer Mode (Ages 9–12)** / **Archivist Mode (Ages 13–18)**, Mute, Quit to Title. The HUD button switches mode directly. |
| **Suit Headlamp** | **`F`** | — | Toggles the astronaut's suit headlamp inside dark lunar crater shadows. |

### 2.3 Tiered Educational UX Modes

Accessible anytime via `P` / `Esc` or the top HUD bar:

* **Explorer Mode (Ages 9–12):** Clear, approachable dialogue boxes focusing on qualitative storytelling, mission history, and intuitive visual physics indicators.
* **Archivist Deep-Dive Mode (Ages 13–18):** Unlocks an extra technical telemetry page on every blueprint and robot dialogue showing verified NASA mass, power wattage, active dates, and physics formulas (`g = 1.62 m/s²` on the Moon, `g = 3.72 m/s²` on Mars, `11-min light-time delay`).

### 2.4 Save Persistence

* Automatic saving via browser **`LocalStorage`** (`abandoned_not_forgotten_save_v1`) storing collected blueprints, dialogue flags, and selected educational mode.

### 2.5 Title Screen

* The title screen artwork is supplied by the team. The game codes the behavior of its buttons:
  * **Continue:** shown only when a save exists.
  * **New Game**.
  * **Mode picker:** Explorer / Archivist.

## 3. The Hub Architecture (NASA Archives)

Rendered as an interactive orbital observation room containing four interactive stations and one decorative Expansion Bay:

```
+----------------------------------------------+
| [STAR MAP]      [PORTAL]     [ARCHIVE COMP]  |
|                                              |
|                (ASTRONAUT)                   |
|                                              |
| [NOTEBOOK]                   [EXPANSION BAY] |
+----------------------------------------------+
```

1. **The Teleportation Portal (Top Center):** Stepping onto the teleporter pad opens the destination selector (`1. THE MOON — Taurus-Littrow`, `2. MARS — Ares Vallis`).
2. **Interactive Star Map (Top Left):** Displays a pixel Solar System map showing active launch missions (`MOON: LRV`, `MARS: SOJOURNER`) and locked expansion beacons.
3. **Archive Computer (Top Right):** Displays unlocked 2-page blueprint schematics, full rover dialogue transcripts, and the **Expansion Roadmap Archive** previewing upcoming missions (*Surveyor 3, Apollo ALSEP/LM, Pathfinder, InSight, Ingenuity, NEAR Shoemaker, Voyager 1*). Triggers the ending montage once both core blueprints are recovered.
4. **Explorer Notebook (`N` Key / Bottom Left):** Tracks core mission progress (`0/2` -> `2/2` Core Blueprints), side-by-side Moon vs. Mars gravity/atmosphere stats, and expansion status.
5. **Expansion Bay (Bottom Right):** Decorative only: sealed "coming soon" crates for the three expansion packs, with no menu. The expansion catalog itself lives in the Archive Computer.

## 4. Core Playable Expeditions, Physics & Rover Dialogues

### 4.1 Expedition 1: The Moon (*Taurus-Littrow Valley — Apollo 17 Site*)

* **Planetary Physics & Mechanics:**
  * **Lunar Gravity (`0.166g` / `1.62 m/s²`):** While walking, the astronaut automatically bounds in animated low-gravity hops: higher and floatier than on Mars, derived from real gravity. There is no jump key.
  * **Crater Shadows & Headlamp:** Shaded crater zones render pure black until the player presses `F` to illuminate a dynamic radial flashlight cone.
  * **Surface Fact Pop-ups:** 3–4 short facts trigger when walking near terrain features.
* **Collectible Core Blueprint (1):**
  1. **Lunar Roving Vehicle (LRV) Mobility & Battery System**
* **Interactive Robot (1):**
  * **Lunar Roving Vehicle (LRV — Apollo 17):**
    * *Not drivable:* its non-rechargeable batteries read 0%. Players explore its real hardware instead: nav-console replays of the actual Apollo 17 drives, panning its TV camera, its battery panel, and its repaired fender.
    * *Greeting:* `"Telemetry static... Wheel encoders idle since December 14, 1972. Welcome to Taurus-Littrow, Explorer."`
    * *Question Menu (Pokémon-style):* 5–6 questions plus "Goodbye", asked in any order and repeatable. It includes:
      * *"How far did you carry the astronauts?":* Explains driving 35.9 km across lunar craters and mountains during Apollo 17, carrying two astronauts, tools, and 110 kg of moon rocks.
      * *"Why were you left behind on the Moon?":* Explains mass limits on the Apollo Lunar Module Ascent Stage—and how its TV camera stayed behind to film the crew's liftoff from the Moon.

### 4.2 Expedition 2: Mars (*Ares Vallis — Mars Pathfinder Site*)

* **Planetary Physics & Mechanics:**
  * **Martian Gravity (`0.38g` / `3.72 m/s²`):** Faster stride than Earth-bound gear but heavier than the Moon, paired with drifting red dust particle effects across the canvas.
  * **Communication Latency Gauge:** After each question the player picks, a `SIGNAL ~11 min` Earth-Mars light-time bar fills (compressed to ~2 s) before Sojourner answers. Archivist Mode explains that the delay varied as Earth and Mars moved (about 10.6 min at landing).
  * **Surface Fact Pop-ups:** 3–4 short facts trigger when walking near terrain features.
* **Collectible Core Blueprint (2):**
  2. **Sojourner Rover 6-Wheeled Rocker-Bogie Mobility System**
* **Interactive Robot (1):**
  * **Sojourner Mars Rover:**
    * *Greeting:* `"Beep... Earth signal latency: 11 mins... Wait—a human archivist right here in Ares Vallis!"`
    * *Question Menu (Pokémon-style):* 5–6 questions plus "Goodbye", asked in any order and repeatable. It includes:
      * *"What was it like being Mars' first rover?":* Explains landing on July 4, 1997, rolling down the Pathfinder ramp on July 5, and exploring for 83 sols—12 times longer than its planned 7-sol mission.
      * *"How did you navigate rocks without live steering?":* Explains its laser-striping hazard sensors and autonomous onboard computer that avoided obstacles without waiting 22 minutes for round-trip Earth commands.

## 5. Technical Blueprint Database & Modular Expansion Roadmap

### 5.1 Core Playable Blueprints (Included at Launch)

Each blueprint opens a **2-Page Interactive Schematic Card**:
* **Page 1:** Crisp pixel-art wireframe schematic on a dark NASA blueprint grid + hardware name & active dates.
* **Page 2 (`Space` / `Enter`):** Historical mission aim, scientific discovery, and (in **Archivist Mode**) full telemetry specifications.

1. **Lunar Roving Vehicle (LRV)**
   * *Verified Telemetry:* 210 kg dry mass | 490 kg lunar payload capacity | Dual 36V Silver-Zinc non-rechargeable batteries (121 Ah each) | 4 × 0.25 hp DC wheel motors | Max speed: 18 km/h
   * *History & Aim:* Deployed on Apollo 15, 16, and 17 (December 1972 in Taurus-Littrow); expanded surface exploration radius from walking distance to over 7.6 km from the Lunar Module.
2. **Sojourner Mars Rover**
   * *Verified Telemetry:* 10.5 kg (23 lbs) mass | 0.65 m × 0.48 m × 0.30 m | 16W Gallium Arsenide solar panel + LiSOCl2 backup batteries | 6-wheel rocker-bogie suspension | Alpha Proton X-Ray Spectrometer (APXS)
   * *History & Aim:* Deployed July 5, 1997 in Ares Vallis; the first wheeled rover on Mars, operating 83 sols to analyze Martian rock chemistry (*Barnacle Bill*, *Yogi*) and prove autonomous surface navigation.

### 5.2 Planned Expansion Packs (Cataloged in Hub Archive Computer)

Structured as modular JSON/JS data packs for post-hackathon release:
* **Expansion Pack 1 — Lunar Legacy:** *Surveyor 3 Scoop & Camera* (Oceanus Procellarum, 1967), *Apollo Lunar Module Descent Stage*, and *ALSEP Seismic Station* (operated until Sept 30, 1977).
* **Expansion Pack 2 — Martian Frontiers:** *Mars Pathfinder Vectran Airbags* (1997), *InSight Lander SEIS Seismometer* (Elysium Planitia, 2018–2022), and *Ingenuity Mars Helicopter* (Jezero Crater, 72 flights, 2021–2024).
* **Expansion Pack 3 — Deep Space & Interstellar:** *NEAR Shoemaker Asteroid Lander* (Asteroid 433 Eros, Feb 2001) and *Voyager 1 & The Golden Record* (>1 light-day from Earth).

## 6. Ending Sequence & Core Mission Message

1. **Core Archive Complete (`2/2`):** Collecting both the **LRV** and **Sojourner** blueprints updates the Explorer Notebook to **100% Core Archive Complete** and unlocks the **Archive Computer Recap** back at the NASA Archives Hub.
2. **Interactive Comparison & Montage:** The Archive Computer displays a side-by-side STEM telemetry comparison of the Moon (`0.166g`, airless regolith, battery-powered crewed rover) vs. Mars (`0.38g`, thin CO2 atmosphere, solar-powered autonomous rover), followed by a pixel-art montage of the LRV parked in Taurus-Littrow and Sojourner resting beside Pathfinder in Ares Vallis:

> *"Though their batteries fade, their solar panels cover with dust, and their wheels fall silent across the planetary voids... these robotic pioneers carry human curiosity into the dark.*
>
> *They remain abandoned on other worlds, but never forgotten."*