# 去远方 / Dream Journey

An interactive, bilingual atlas of children’s curiosity. Seven fictional student research journeys live on an interactive 3D globe, alongside a draggable proposal archive, branching research constellation, hand-drawn travel routes, and an artifact exhibition.

## Preview and verify

No installation or build is required. Serve the repository with `python3 -m http.server 8000`, then open [the local preview](http://localhost:8000).

- `npm run check` checks all application modules.
- `npm test` verifies geographic bounds, route geometry, localization coverage, and static asset paths.
- Open [the browser checks](http://localhost:8000/tests/browser.html) and click **Run browser checks** to verify the actual WebGL globe, zoom limits, navigation, language persistence, dialogs, history, mobile overflow, and WebGL fallback.

## Structure

```text
index.html                  Static entry point
src/
  js/
    app.js                  Page rendering, navigation, gallery, and dialogs
    artwork.js              Illustrated student proposals
    data.js                 Fictional journeys, geographic coordinates, bilingual stories
    globe.js                Three.js globe, markers, input, and resource cleanup
    globe-math.js           Geographic conversion, camera bounds, and spherical routes
    i18n.js                 Chinese/English interface text and language preference
    route.js                Hand-drawn journey illustrations
  styles/main.css           Paper-atlas design and responsive layouts
assets/
  images/field.jpg           Illustrative landscape photograph
  maps/land.geojson          Simplified world country geometry
vendor/three/               Pinned Three.js 0.180.0 modules and MIT license
scripts/check.mjs           Syntax verification
tests/                      Node tests and interactive browser checks
.github/workflows/deploy.yml GitHub Pages validation and deployment
```

## Interaction

- Drag the globe to explore China; scroll, pinch, or use **+ / −** to zoom. The camera focus is clamped to China’s geographic extent (73–135°E, 18–53°N), and zoom is bounded. The surrounding globe remains visible for context.
- With the globe focused, arrow keys move the view, **+ / −** zoom, and **Home** restores the overview. The reset button does the same.
- Select a destination or proposal to follow a journey. Geography and globe routes use representative real coordinates; the illustrated travel diagrams are schematic.
- Switch **中 / EN** in the header or artifact dialog. The current journey, reading position, selected project, and globe viewpoint are retained. The browser remembers the language when storage is available.
- Navigation highlights the atlas, archive, or journey currently being viewed. Opening **The idea** temporarily highlights that item; closing it restores the underlying page’s selection. Direct journey links and browser Back/Forward are supported.
- If WebGL is unavailable, the destination picker and every journey remain usable.

## Deployment

The GitHub Actions workflow validates the modules and tests, then publishes only `index.html`, `src/`, `assets/`, and `vendor/` to GitHub Pages. In repository **Settings → Pages**, choose **GitHub Actions** as the source. Pushes to `main` deploy automatically.

## Sources

- [Three.js 0.180.0](https://github.com/mrdoob/three.js/tree/r180), MIT. The license is included in `vendor/three/THREE-LICENSE.txt`. Both modules are served locally; no runtime globe CDN is required.
- [Natural Earth country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). `assets/maps/land.geojson` retains only geometry rounded to three decimal places and country codes. This small-scale atlas is illustrative and is not an authoritative boundary or navigation dataset.
- The existing landscape photograph is from Unsplash. All student stories, quotes, proposals, routes, and research artifacts are fictional demonstration content.

This is a static frontend prototype with no backend or data collection. Only the language preference is stored in the browser.
