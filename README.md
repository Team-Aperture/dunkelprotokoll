# Die Kalibrierungsanlage: Dunkelprotokoll

A first-person, grid-based 3D maze for the browser. The facility has lost power
during a storm — you can only see during brief **lightning flashes**. Feel your
way through the dark, press buttons to open doors, **descend three floors by
ladder**, collect every **page** on every floor, and reach the bottom exit to
have the facility release its coordinates.

Built as a single self-contained file (`index.html`) using **Three.js r128**.
Fully playable on desktop (keyboard) and mobile (on-screen D-pad), and fully
solvable **without sound**.

## Play

Open `index.html` in a modern browser (it loads Three.js r128 from a CDN, so an
internet connection is needed the first time). Or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move forward / back | `W` `S` or `↑` `↓` | D-pad up / down |
| Turn left / right | `A` `D` or `←` `→` | D-pad left / right |
| Press button / interact | `Space` | center **DRUCK** button |
| Use a ladder (change floor) | step onto it | step onto it |

There is **no strafe** and **no death/reset** — navigation in the dark is the
only challenge (a hunter enemy is a later planned pass). Progress spans all three
floors. Checkpoint cells act as a **quiet autosave** (floor, position, opened
doors, collected pages, explored map), so a refresh or accidental close resumes
you there (`↻` top-right restarts from scratch).

### Seeing in the dark

- The world is near-black; you can make out only a cell or two by your own faint
  light.
- A **lightning flash** every 8 beats (4.8 s at 100 BPM) briefly lights up what
  you can see down the corridors, then fades.
- The **visual metronome** (top center) pulses 100 BPM in 4/4 and counts down to
  the next flash — the flash always lands on beat **1 of every other bar**. This
  makes the game fully solvable with the sound off.
- The **minimap** (top-right) is **fog-of-war**: it only ever shows cells you've
  already seen in a flash, centered on you, with your facing arrow. It never
  reveals the unexplored maze.

Sound is optional. Drop a file at `audio/storm.mp3` and toggle 🔊 to play storm
ambience; timing never depends on audio.

## Tuning (difficulty knobs)

All the main feel/difficulty constants are at the top of the `<script>` in
`index.html`:

```js
var BPM                  = 100;   // storm clock
var FLASH_INTERVAL_BEATS = 8;     // flash every N beats
var FLASH_DURATION       = 0.40;  // bright seconds
var FLASH_FADE           = 0.30;  // fade seconds
var MOVE_DURATION        = 0.25;  // step / turn animation
var VIEW_RADIUS          = 2;     // flash reveal/map range (short; minimap is a 5x5 window)
var FOG_DARK  = 0.20;             // darkness between flashes (higher = darker)
var FOG_FLASH = 0.05;             // visibility at flash peak (lower = see farther)
```

`prefers-reduced-motion` is respected: the flash is softened (lower peak, gentler
fade, no flicker) and page rotation slows.

## Designing levels (data-driven)

Level layout is **data**, not engine code. To keep the dark maze a real
challenge, the level is shipped **encoded** inside `index.html` (XOR + base64,
decoded only at runtime inside the closure) — reading the page source, browsing
the repo, or poking the console reveals no readable grid, page numbers, or
coordinates. There are two authoring paths; both **validate solvability**
(reachability, door gating, slot/digit counts) and print a ready-to-paste blob.

**Procedural** — how the current floors are made:

```bash
node tools/generate-maze.js     # 3 linked floors (the shipped game)
```

Edit `FLOOR_SPECS` (per-floor width, height, seed, page slots) to resize or
reshuffle. It auto-places spawn, ladders, a door-gated descent per floor, the
final exit, buttons, spread-out pages, and checkpoints, validating every floor.
The mazes are never committed as plaintext — only the algorithm + seeds.

**Hand-authored** — bespoke layouts:

```bash
node tools/encode-level.js      # edit the example floor(s) first
```

Either way, paste the printed `var LEVEL_BLOB = "...";` into `index.html`. No
engine changes required.

Grid legend: `#` wall · `.` floor · `S` spawn · `E` exit · `C` checkpoint.

## Scope

This is the **engine + three procedurally generated floors** linked by ladders.
Tune floor size/difficulty via `FLOOR_SPECS` in the generator. A hunter enemy
(the V-NTG) is the next planned pass.

## A note on the source

There's a friendly Easter egg in the source and console for a certain
source-reading geocacher. By design it contains **no hints, coordinates, or
solution data** — and the level data is encoded specifically so that reading the
source or using the console gives **zero gameplay advantage**. The dark is for
everyone.
