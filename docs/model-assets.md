# Model assets

The repository includes both the original Studio archive and the browser-ready model. Normal development and builds use the bundled files directly.

| Path                                          | Contents                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `assets/source/mclaren-p1-42172/model.io`     | Original Studio archive                                                     |
| `public/models/mclaren-p1-42172/model.json`   | Part definitions, colors and instance transforms                            |
| `public/models/mclaren-p1-42172/geometry.bin` | Shared Float32 geometry buffer                                              |
| `.cache/mclaren-p1-42172/`                    | Extracted files, downloaded primitives and intermediate MPD; ignored by Git |

## Rebuild

```sh
npm ci
npm run model:prepare
npm run check
```

Rebuilding requires Python 3, `curl` and network access to the official LDraw library. The preparation script extracts the required files directly from `model.io` and resolves missing primitives. The conversion script updates the two runtime files. Commit both runtime files together after an intentional source model change.

The conversion produces 277 unique part definitions and 3,905 selectable instances, shown as 386 reference/color combinations in the default inventory. The display plaque is omitted. This differs from the official set's 3,893-piece inventory. The geometry buffer is about 34 MB before HTTP compression.

## Attribution

- Source model: [Vito Tarantini's Studio model](https://forums.ldraw.org/thread-27891-post-56319.html), shared on the LDraw forum in May 2025.
- Product reference: [LEGO Technic McLaren P1, set 42172](https://www.lego.com/en-us/service/building-instructions/42172).
- LDraw primitives: [LDraw licensing](https://www.ldraw.org/article/349.html). Source headers are preserved in the original archive and intermediate packed MPD.
- Interaction reference: [Human Atlas](https://github.com/ashemag/human-atlas), MIT. Its notice is preserved in `public/THIRD_PARTY.txt`.

The root MIT license covers this application's original code, not third-party model assets or trademarks. No separate redistribution license for the community Studio model is recorded in this repository. LEGO and McLaren trademarks belong to their respective owners.

## Rendering limits

Part families are classified from source descriptions, not official assembly groups. Cover controls translate source submodels upward; they do not simulate hinges, doors, suspension or drivetrain physics. The lightweight conversion omits edge lines, smoothing rules, transparency and some custom decals. Source part names remain in English.
