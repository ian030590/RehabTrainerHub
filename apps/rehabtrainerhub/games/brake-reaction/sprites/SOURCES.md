# Brake reaction sprite sources

The car atlas uses Kenney Car Kit 3.1 under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The eight GLBs share `Textures/colormap.png` from the kit's `Models/GLB format` folder. [Kenney Car Kit](https://kenney.nl/assets/car-kit)

| Frame | Model | Width (m) |
| --- | --- | --- |
| `sedan` | `sedan.glb` | 1.80 |
| `suv` | `suv.glb` | 1.90 |
| `ev` | `hatchback-sports.glb` | 1.78 |
| `sport` | `sedan-sports.glb` | 1.85 |
| `decoy-van` | `van.glb` | 2.00 |
| `decoy-taxi` | `taxi.glb` | 1.80 |
| `decoy-suv` | `suv-luxury.glb` | 1.95 |
| `decoy-delivery` | `delivery.glb` | 2.05 |

The bake recolors the CC0 body paint to light silver for `sedan`, dark slate gray for `suv`, white for `ev`, deep blue for `sport`, and muted purple for `decoy-suv`. The lamp, window, bumper, and tyre swatches retain their original colors.

The game draws the lamp overlays, road, sky, and scenery in code and releases that artwork under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

## Rebuild

The kits are not stored in this repository. Pass their parent directory to `--kits` after extracting `car-kit` with its `License.txt`. The bake uses the installed repository dependencies and a local Brave executable. Set `BRAVE_BIN` if Brave is installed at a custom path.

```sh
node scripts/brake-reaction-sprites/build.mjs --kits .tmp/kenney --preview .tmp/brake-sprites-preview.png
```

The bake writes `cars.json` and a transparent `cars.png` or `cars.webp`. The latter uses quality 0.9 when it saves at least 30% of the PNG bytes. The optional contact sheet outlines the detected tail lamps in turquoise and the computed third brake lamp in yellow.

Draw each frame with its horizontal center on the vehicle centerline and its bottom edge at the tyre contact line. The frame has a 2 px transparent top and side border, and the atlas separates rows by 2 px below the tyre contact line. Lamp rectangles use fractions of the frame dimensions, measured from the top-left.
