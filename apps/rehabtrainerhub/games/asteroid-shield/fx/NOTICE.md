# Notices

**Hugo Duprez.** `src/core/sim.js` and the effects that say so at the top of their file adapt Sprite Fusion's
open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx), Copyright (c) 2026 Hugo Duprez, MIT License.

This game vendors only the rendering dependencies of `impacts/parry`, `impacts/blunt-hit` and
`impacts/hit-spark`, plus their `_lib.js` helper. It does not include the acting system or gallery font.

Copied from the local pixelfx checkout on 2026-11-02. Function declarations and local identifiers
were renamed to follow this repository's naming rules; effect imports were adjusted to `../core/index.js`.
The core barrel exports only the required modules. Rendering formulas and seeded simulations are unchanged.
The game supplies its existing blue/white theme ramp and lowers the glow; playback ends within 0.9 seconds.

The upstream MIT license is retained in `LICENSE-pixelfx.md`. Vite also emits it beside the built package.
