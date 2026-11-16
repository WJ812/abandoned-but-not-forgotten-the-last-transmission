# Abandoned but not Forgotten - The Last Transmission

*They remain abandoned on other worlds, but never forgotten.*

This is a retro pixel-art exploration game made for the **NASA Space Apps Challenge Beirut 2026**. You play as the Archivist and visit robots humanity left behind on other worlds. Each one tells you its final story, its *last transmission*, before falling silent.

- **The Moon, Taurus-Littrow:** the Apollo 17 Lunar Roving Vehicle. It has been parked since December 1972, and its batteries are dead.
- **Mars, Ares Vallis:** the Sojourner rover. It has been silent since its last contact on 27 September 1997.

Everything in the game is based on real NASA mission data. Where a value is estimated, the game says so.

**Team:** Walid Joujou (International College, DP1) and Karma Mardirian (Collège de la Sagesse, Terminale)
**Audience:** ages 9–18

## Play

- **Online:** **https://wj812.github.io/abandoned-but-not-forgotten-the-last-transmission/**. It's hosted on GitHub Pages.

> **📱 Note on devices:** The submitted version is a web app built for desktop and laptop browsers, with keyboard controls. Mobile and touch support is planned, but it wasn't built during the hackathon, so it isn't part of the submitted version.

### Fully web-based: players need only a browser

- **Nothing to install.** There is no download, app, plugin, or account. It runs in any modern desktop browser: Chrome, Edge, Firefox, or Safari.
- **No dependencies on local software.**
  - The game uses no outside libraries, frameworks, or packages, and loads nothing from other websites. It uses the computer's built-in fonts.
  - The sound is generated live in the browser.
  - There is no server-side code: GitHub Pages simply serves the files.
- **About 0.5 MB in total.** It loads like a normal webpage, and nothing is saved to the computer as a file.
- **Progress saves in the browser's own storage,** not as a file. The only file a player can ever get is the optional Notes `.txt`, and only if they click **Download** themselves.
- **Works offline once loaded.** After the page has opened, it needs no internet connection.

### For developers only (not needed to play)

- **Run locally:** requires [Node.js](https://nodejs.org/) 22 or later. Node.js is used only for the local test server and the automated tests. There are no npm packages to install.

  ```sh
  npm start      # serves the game at http://localhost:8080
  npm test       # runs the automated tests
  ```

  The game uses ES modules, so it must be served over HTTP. Opening `index.html` straight from disk won't work.

## Controls (desktop keyboard)

| Action | Keys |
|---|---|
| Move | **W A S D** (or the arrow keys) |
| Interact / confirm | **Space**, **Enter**, or **E** |
| Notebook | **N** (or **B**) |
| Pause menu | **P** or **Esc** |
| Suit headlamp (Moon) | **F** |

## What's in the game

- **Real gravity.** You hop on the Moon (1.62 m/s²) and on Mars (3.72 m/s²). Moon hops are 2.3 times higher, the same as the real gravity ratio.
- **Talk to the rovers.** Each one has a menu of 6 questions. On Mars, every answer waits behind a *SIGNAL ~11 min* bar, because that's how long a radio message takes to travel between Earth and Mars.
- **Real hardware on one screen per rover.**
  - **LRV:** a replay of its real drives, its dead silver-zinc batteries with a graph of their charge over time, a TV camera that waits out the 1.3 s Earth-Moon light delay, and its taped-up fender.
  - **Sojourner:** its solar panel, the APXS rock analyzer (Barnacle Bill and Yogi), its hazard-detecting lasers, and a replay of its 1997 drives.
- **Walk-around facts** about the terrain on both worlds.
- **Crater shadows on the Moon** stay black until you switch on your headlamp.
- **Two modes.** Explorer (ages 9–12) tells the story. Archivist (ages 13–18) adds the real telemetry and the physics.
- **The Archive Computer in the Hub** holds the Notebook, the Star Map, the blueprints, conversation transcripts, the expansion catalog, and the ending: a Moon-vs-Mars recap, a two-frame montage, the closing message, and rolling credits (team and NASA sources).
- **A clear goal:** an objective line at the top, an "OBJECTIVE COMPLETE" banner, and a recap that shows both rovers.
- **Fits any screen:** the whole game scales to the browser window.
- **Autosave** to your browser.

## Project structure

```
index.html            entry page
src/contract.js       shared constants and API definitions for all modules
src/assets.js         art and sound manifest (missing files show labeled placeholders)
src/data/             NASA content, dialogue, scene layouts, hardware specs
src/engine/           physics, collision, triggers, hardware simulations, saving (runs headless under Node)
src/gfx/, src/ui/     canvas renderer, input, screens, effects, sound
src/main.js           start-up and game loop
Artwork/              the team's pixel art
docs/                 bug fix log and known issues
```

The code is vanilla JavaScript ES modules and HTML5 Canvas, with no build step and no dependencies. Data flows one way: **UI → engine → data**.

## Deploying

The game is a static site, hosted on GitHub Pages from the `main` branch (repository root). Every push to `main` redeploys it. There is no build step; `.nojekyll` makes Pages serve the files as-is.

## Documentation

- [`docs/BUGFIXES.md`](docs/BUGFIXES.md): bugs found through testing, and how each was fixed.
- [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md): open issues, likely problem areas, and deliberate limitations.
- [`game_design_specification_web_edition.md`](game_design_specification_web_edition.md): the full design specification.

## Sources

The mission facts come from NASA and JPL sources, including:
- the Apollo 17 Mission Report and the *Apollo Lunar Surface Journal*;
- the LRV operations documentation;
- the Mars Pathfinder and Sojourner mission pages;
- Rieder et al. (1997), *Science*, for the APXS results.

Values that are estimated or traced rather than measured are labeled as such in the game.

## License

© 2026 Walid Joujou and Karma Mardirian. All rights reserved. The source is visible for the NASA Space Apps Challenge, but it is not open source: no license is granted to copy, modify, or redistribute the code or the artwork.
