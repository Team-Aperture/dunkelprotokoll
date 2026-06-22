# Die Kalibrierungsanlage: Dunkelprotokoll

A first-person, grid-based 3D maze for the browser. The facility has lost power
during a storm — you can only see during brief **lightning flashes**. Feel your
way through the dark, press buttons to open doors, collect every **page**, and
reach the exit to have the facility release its coordinates.

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

There is **no strafe** and **no death/reset** — navigation in the dark is the
only challenge. Checkpoint cells act as a **quiet autosave**: step on one and
your position, opened doors, collected pages, and explored map are stored, so a
refresh or accidental close resumes you there (`↻` top-right restarts the floor).

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
var VIEW_RADIUS          = 5;     // how far a flash reveals down a clear corridor
var FOG_DARK  = 0.20;             // darkness between flashes (higher = darker)
var FOG_FLASH = 0.05;             // visibility at flash peak (lower = see farther)
```

`prefers-reduced-motion` is respected: the flash is softened (lower peak, gentler
fade, no flicker) and page rotation slows.

## Designing levels (data-driven)

Level layout is **data**, not engine code. To keep the dark maze a real
challenge, the level is shipped **encoded** inside `index.html` — reading the page
source or the browser console reveals no readable grid, page numbers, or
coordinates. Authoring stays simple:

1. Edit the `LEVEL` object in [`tools/encode-level.js`](tools/encode-level.js)
   (grid + doors/buttons/pages — schema documented in that file).
2. Run it — it **validates solvability** (reachability, door gating, slot/digit
   counts) and prints a new blob:

   ```bash
   node tools/encode-level.js
   ```

3. Paste the printed blob into `index.html` as `var LEVEL_BLOB = "...";`.
   No engine changes required.

Grid legend: `#` wall · `.` floor · `S` spawn · `E` exit · `C` checkpoint.

## Scope

This is the **engine + one test floor** for playtesting feel. The final three
floors are intentionally not built yet — design them later via the workflow above.

## A note on the source

There's a friendly Easter egg in the source and console for a certain
source-reading geocacher. By design it contains **no hints, coordinates, or
solution data** — and the level data is encoded specifically so that reading the
source or using the console gives **zero gameplay advantage**. The dark is for
everyone.
