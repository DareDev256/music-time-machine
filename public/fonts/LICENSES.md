# Fonts used by the share card (`src/app/api/card`)

Static TTFs, because Satori (the `next/og` renderer) cannot read woff2 or variable axes.
All three families are under the SIL Open Font License 1.1; the full licence text for each sits beside it.

| File | Family | Source | Licence | Changes |
|---|---|---|---|---|
| `Archivo-Condensed68-ExtraBold.ttf` | Archivo, Copyright 2020 The Archivo Project Authors | `google/fonts` `ofl/archivo/Archivo[wdth,wght].ttf` | OFL 1.1, no Reserved Font Name (`OFL-Archivo.txt`) | Instanced with fontTools at `wdth=68 wght=800` to match the site's `.display` (font-stretch 68%, weight 800). GPOS and DSIG removed: Satori kerns glyphs but lays words out unkerned, which left a gap after every kerned pair ("LY", "AY"). |
| `JetBrainsMono-Regular.ttf`, `JetBrainsMono-SemiBold.ttf` | JetBrains Mono, Copyright 2020 The JetBrains Mono Project Authors | JetBrains/JetBrainsMono release v2.304, `fonts/ttf/` | OFL 1.1 (`OFL-JetBrainsMono.txt`) | None |
| `DSEG7Classic-Bold.ttf` | DSEG7 Classic, Copyright (c) 2017 keshikan, Reserved Font Name "DSEG" | keshikan/DSEG release v0.46, `DSEG7-Classic/` | OFL 1.1 (`OFL-DSEG.txt`) | None (unmodified, so the reserved name is kept lawfully) |

`src/app/api/card/metrics.ts` holds the Archivo advance widths, generated from this exact file; regenerate it if the font changes.
