# 去远方 / Dream Journey

An interactive, bilingual atlas of children’s curiosity, with a DeepSeek project assistant. The four original supplied journey records retain their confirmed covers and destinations; unfilled content is hidden. Administrators can upload materials, have DeepSeek fill a draft, review it, and publish a new journey for every visitor.

## Project assistant

Choose **＋ 新建项目 / New project** in the header. Upload PDF, DOCX, UTF-8 TXT/Markdown/JSON, PNG, JPEG, WebP or optional GLB model files (up to 10 files, 8 MB each, 20 MB total). Enter the administrator password and choose **Organize with DeepSeek**. The assistant extracts bilingual project details, research stages, field notes and further questions, and shows source quotations and warnings. Edit either language, choose file purposes and captions, then choose **Create & publish**. Missing information stays empty in the draft and is omitted from the public project page. Manual entry is also available.

Publishing saves the project and its selected public files to the server, rather than browser storage. All visitors load the published records from the same API, including after a reload or server restart. Reference-only originals are used for analysis and never written to the public store. Cover/field images and report/notebook/reflection files are explicitly labeled public in the review panel. PDF and Word outcomes are downloadable from the project viewer. Failed requests retain the draft, and retrying a publication uses the same ID to avoid duplicate projects. Drafts and the upload password are kept in memory only and are lost on reload; closing the assistant clears the password.

Only administrators can analyze or publish; public visitors can read projects without credentials. The website never receives the DeepSeek API key. The upload panel reports configuration errors instead of simulating AI results or falling back to browser-only publication.

### Run the shared project service

Use Node.js 22.16+ (Node.js 22 LTS recommended). Install with `npm ci`, copy `.env.example` to `.env`, and configure:

```dotenv
DEEPSEEK_API_KEY=your-server-side-deepseek-key
DEEPSEEK_MODEL=deepseek-flash
JOURNEY_ADMIN_TOKEN=your-long-random-upload-password
HOST=127.0.0.1
PORT=8000
JOURNEY_DATA_DIR=./storage
```

Run `npm start`, then open [the local website](http://127.0.0.1:8000). Without a DeepSeek key, manual publishing remains available if an administrator password is configured. Without the administrator password, all write endpoints are disabled. `.env` and `storage/` are ignored by Git. Never reuse the DeepSeek API key as the administrator password.

For production, run the service behind HTTPS, set `HOST=0.0.0.0` if your host requires it, and mount `JOURNEY_DATA_DIR` on a persistent writable volume. Back up that directory. The supplied file store is intended for one service instance; ephemeral/static hosting cannot retain published projects. Configure the proxy to accept request bodies of at least 29 MB and allow at least 180 seconds for document analysis. Public read endpoints are `GET /api/projects` and `GET /api/agent/status`. `POST /api/agent/analyze` and `POST /api/projects` require `Authorization: Bearer <JOURNEY_ADMIN_TOKEN>`. Do not expose the data directory directly; the server serves only selected public uploads.

### Keep the GitHub Pages frontend

GitHub Pages can continue serving the frontend, but it cannot run the project service. Deploy the Node service separately, set `JOURNEY_ALLOWED_ORIGINS=https://ivyw070707-gif.github.io` on that service, and set the `journey-api-base` meta tag in `index.html` to the API's HTTPS root, for example `https://api.example.com/`. Leave the meta tag empty when the Node server serves the entire website. Media links are resolved against that API root as well. The existing Pages workflow deploys only public frontend files; it never uploads `.env`, server code, or project storage.

### Optional 3D models

Upload at most one `.glb` (GLB 2.0) with embedded geometry and textures. It automatically receives the public **3D model** role; no model is required to create a project. The existing 8 MB per-file and 20 MB combined limits apply. Models are saved as public project media and excluded from DeepSeek requests. Export without Draco, Meshopt or KTX2 compression and without external texture/buffer links. Invalid models or multiple model files are rejected.

The viewer uses the same locally hosted Three.js r180 runtime as the globe. Its `GLTFLoader`, `OrbitControls` and `BufferGeometryUtils` addons are pinned to that version; `node scripts/vendor-model-addons.mjs` refreshes these vendor copies from the exact development dependency. There is no model-viewer CDN. Navigation disposes GPU resources and event handlers; animations pause when the viewer is offscreen or the page is hidden. `tests/fixtures/model.glb` is a generated animated box used only for verification and is never added to the real project records.

Run `npm run test:live` after configuring `.env` to make one real DeepSeek request using generated test materials, then verify publication and GLB downloads in temporary storage. This explicit check may incur API usage; it never writes to your real project store and cleans its temporary records. It is separate from `npm test`.

### Extraction behavior

The server calls DeepSeek's [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) in [JSON output mode](https://api-docs.deepseek.com/guides/json_mode/). Its default `deepseek-flash` supports [image understanding](https://api-docs.deepseek.com/guides/vision/), so supplied images are analyzed directly. PDF text is extracted locally, and fully scanned PDFs are rendered to images (first 10 pages). Text PDFs are limited to the first 60 pages and all documents to 120,000 extracted characters; truncation is reported in the preview. DOCX text is extracted locally; embedded Word images are not analyzed. Export to PDF or upload those images separately when needed. Mixed PDFs with both text and scanned pages should be exported to images if the scanned pages contain essential information. Coordinates are only populated when present in the supplied materials; they can be entered manually within the existing China map. Journeys without coordinates still appear in the archive.

## Preview and verify

For the complete upload and shared publication flow, use `npm ci` and `npm start` as described above. A frontend-only preview still works with `python3 -m http.server 8000`, but shows the project service as disconnected.

- `npm run check` checks frontend and backend modules.
- `npm test` verifies the atlas plus authorization, real PDF/DOCX/scanned-page parsing, the DeepSeek request contract with a stubbed provider, failed/truncated replies, public persistence across server instances, file privacy, invalid uploads, idempotent publication, origin restrictions, GLB storage and validation, and omission of unfilled project content. Automated tests do not contact DeepSeek or incur API charges; an end-to-end live model check requires your configured key.
- Open [the browser checks](http://localhost:8000/tests/browser.html) and click **Run browser checks** to verify the actual WebGL globe, zoom limits, navigation, language persistence, dialogs, history, mobile overflow, and WebGL fallback.
- Open [the assistant browser checks](http://localhost:8000/tests/agent-browser.html) and click **Run assistant checks** to verify file previews, autofill and editable bilingual drafts, file roles, source evidence, publication payloads, safe rendering, document outcomes, additional map markers, missing coordinates, real GLB rendering/zoom/reset/animation/retry, hidden empty sections and the mobile dialog. This page labels its stubbed API explicitly and creates no real projects.

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
    project-agent.js        Upload, AI extraction, editable review and publication
    project-api.js          Shared API requests and cross-host media URLs
    project-schema.js       Shared validation, localization and file limits
    project-view.js         Project markup that omits unfilled content
    glb.js                  Shared portable GLB validation
    model-viewer.js         Interactive GLB rendering and resource cleanup
  styles/main.css           Paper-atlas design and responsive layouts
  styles/journal.css        Field-journal palette, brand and decoration
  styles/agent.css          Responsive project assistant
  styles/model.css          Optional model viewer and content layouts
server/                     DeepSeek integration, document readers and durable file store
assets/
  images/journeys/          Four original supplied cover images
  maps/land.geojson          Simplified world country geometry
vendor/three/               Pinned Three.js 0.180.0 modules and MIT license
scripts/check.mjs           Syntax verification
tests/                      Node tests and interactive browser checks
.github/workflows/deploy.yml GitHub Pages validation and deployment
```

## Interaction

- The entrance retains the minimal **去远方** title and interactive map. Its small **Journeys** and **New project** controls open the full archive or upload assistant on demand.
- Select a destination marker to open its poster gallery over a blurred map. Only projects for that destination appear; choose a poster to enter its project. The full archive also includes published projects without coordinates.
- Close a gallery with its return button, Escape, or the open backdrop. Browser Back from a project restores its gallery. Direct `#gallery/suzhou`, `#journey/suzhou`, and `#journeys` links work.
- The entrance retains the interactive **3D globe**, with dragging and bounded zoom. The painterly China atlas is used only as a fallback when WebGL is unavailable. Both use the known destination coordinates and open the latest destination poster galleries.
- Project pages show only filled content. Empty facts, research questions, notes, research stages, photographs, outcomes, further questions and whole empty sections are omitted. A schematic route appears only when departure and destination are known; an unfilled transport label is omitted. The four initial projects display only their supplied title, cover and destination.
- If a project has a GLB model, it appears in its research outcomes with pointer/touch rotation, bounded zoom, reset, keyboard controls and download. Embedded animations can be played or paused explicitly; they do not autoplay. A failed load or unavailable WebGL shows a retry control and keeps the model download available.
- Language switching remains available inside project pages, retaining project navigation and translating the galleries and model controls. Public content falls back to the supplied language when a translation is absent.

## Adding content later

Edit the corresponding `journey({...})` record in `src/js/data.js`. `journey()` provides a fresh empty framework for each record; override only fields for which you have content. Text fields use `{zh: "…", en: "…"}`; an unknown year stays `null`. `researchNotes` has 13 optional bilingual entries, `fieldPhotos` accepts `{src, alt, caption}`, `finalOutcomes` has three optional `{src, caption: {zh, en}}` entries, and `unansweredQuestions` accepts bilingual text entries. Leave missing content empty rather than replacing it with sample stories; empty entries are hidden from visitors. An optional `model` accepts `{src, name, caption: {zh, en}, mime: "model/gltf-binary"}` for a self-contained GLB file.

The supplied mapping is: `tulou.png` → 漳州 / Zhangzhou; `suzhou.png` → 苏州 / Suzhou; `dunhuang.png` → 敦煌 / Dunhuang; `miao-interview.png` → 贵阳 / Guiyang.

## Deployment

The GitHub Actions workflow validates the modules and tests, then publishes only `index.html`, `src/`, `assets/`, and `vendor/` to GitHub Pages. In repository **Settings → Pages**, choose **GitHub Actions** as the source. Pushes to `main` deploy automatically.

## Sources

- [Three.js 0.180.0](https://github.com/mrdoob/three.js/tree/r180), MIT. The license is included in `vendor/three/THREE-LICENSE.txt`. Both modules are served locally; no runtime globe CDN is required.
- [Natural Earth country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). `assets/maps/land.geojson` retains only geometry rounded to three decimal places and country codes. This small-scale atlas is illustrative and is not an authoritative boundary or navigation dataset.
- The four cover photographs were supplied by the user and are retained unchanged, including their original aspect ratios. No content was transcribed from inside the images beyond the cover labels; no research claims, personal names, dates, routes or outcomes were invented.

Only the language preference is stored persistently in the browser. Uploaded reference materials are sent to DeepSeek when an administrator requests analysis, and published projects and their selected public files are stored on the project server.
