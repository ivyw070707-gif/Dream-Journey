# 去远方 / Dream Journey

An interactive, bilingual atlas of children’s curiosity. Four supplied journey covers live on an interactive 3D globe, alongside a draggable cover archive and clearly marked spaces for research, fieldwork and outcomes. Only the covers, cover titles and user-confirmed destinations are populated; all other journey content remains empty.

## Preview and verify

No installation or build is required. Serve the repository with `python3 -m http.server 8000`, then open [the local preview](http://localhost:8000).

- `npm run check` checks all application modules.
- `npm test` verifies geographic bounds, destination coordinates, empty-content invariants, localization coverage, and static asset paths.
- Open [the browser checks](http://localhost:8000/tests/browser.html) and click **Run browser checks** to verify the actual WebGL globe, zoom limits, navigation, language persistence, dialogs, history, mobile overflow, and WebGL fallback.

## Structure

```text
index.html                  Static entry point
src/
  js/
    app.js                  Page rendering, navigation, gallery, and dialogs
    data.js                 Four cover records, destinations and empty content fields
    globe.js                Three.js globe, markers, input, and resource cleanup
    globe-math.js           Geographic conversion and China camera bounds
    i18n.js                 Chinese/English interface text and language preference
    landscape.js            Decorative artwork from the field-journal design
    route.js                Hand-drawn itinerary framework
  styles/main.css           Paper-atlas design and responsive layouts
  styles/journal.css        Field-journal palette, brand and decoration
assets/
  images/journeys/          Four original supplied cover images
  maps/land.geojson          Simplified world country geometry
vendor/three/               Pinned Three.js 0.180.0 modules and MIT license
scripts/check.mjs           Syntax verification
tests/                      Node tests and interactive browser checks
.github/workflows/deploy.yml GitHub Pages validation and deployment
```

## Interaction

- Drag the globe to explore China; scroll, pinch, or use **+ / −** to zoom. The camera focus is clamped to China’s geographic extent (73–135°E, 18–53°N), and zoom is bounded. The surrounding globe remains visible for context.
- With the globe focused, arrow keys move the view, **+ / −** zoom, and **Home** restores the overview. The reset button does the same.
- The globe displays exactly four destination markers: **Zhangzhou** (Tulou), **Suzhou**, **Dunhuang** and **Guiyang** (Miao interview). It never plots departure points or travel lines. City coordinates are representative map positions.
- Select a destination or cover to open a journey. The detail page retains empty slots for its research question, participants, departure, theme, year, notes, 13 research stages, field photographs, three outcomes and further questions. The hand-drawn itinerary labels the known destination and leaves departure and transport empty.
- Switch **中 / EN** in the header or artifact dialog. The current journey, reading position, selected project, and globe viewpoint are retained. The browser remembers the language when storage is available.
- Navigation highlights the atlas, archive, or journey currently being viewed. Opening **The idea** temporarily highlights that item; closing it restores the underlying page’s selection. Direct journey links and browser Back/Forward are supported.
- If WebGL is unavailable, the destination picker and every journey remain usable.
- The leaf brand, warm paper palette and decorative landscape artwork from the field-journal design are retained. Decorative landscapes are hidden from assistive technology and are separate from every journey’s empty records.

## Adding content later

Edit the corresponding `journey({...})` record in `src/js/data.js`. `journey()` provides a fresh empty framework for each record; override only fields for which you have content. Text fields use `{zh: "…", en: "…"}`; an unknown year stays `null`. `researchNotes` has 13 optional bilingual entries, `fieldPhotos` accepts `{src, alt, caption}`, `finalOutcomes` has three optional `{src, caption: {zh, en}}` entries, and `unansweredQuestions` accepts bilingual text entries. Leave missing content empty rather than replacing it with sample stories.

The supplied mapping is: `tulou.png` → 漳州 / Zhangzhou; `suzhou.png` → 苏州 / Suzhou; `dunhuang.png` → 敦煌 / Dunhuang; `miao-interview.png` → 贵阳 / Guiyang.

## Deployment

The GitHub Actions workflow validates the modules and tests, then publishes only `index.html`, `src/`, `assets/`, and `vendor/` to GitHub Pages. In repository **Settings → Pages**, choose **GitHub Actions** as the source. Pushes to `main` deploy automatically.

## Sources

- [Three.js 0.180.0](https://github.com/mrdoob/three.js/tree/r180), MIT. The license is included in `vendor/three/THREE-LICENSE.txt`. Both modules are served locally; no runtime globe CDN is required.
- [Natural Earth country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). `assets/maps/land.geojson` retains only geometry rounded to three decimal places and country codes. This small-scale atlas is illustrative and is not an authoritative boundary or navigation dataset.
- The four cover photographs were supplied by the user and are retained unchanged, including their original aspect ratios. No content was transcribed from inside the images beyond the cover labels; no research claims, personal names, dates, routes or outcomes were invented.

This is a static frontend prototype with no backend or data collection. Only the language preference is stored in the browser.
