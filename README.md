# 去远方 / Dream Journey

An interactive atlas of children’s curiosity. A responsive frontend prototype with seven fictional research journeys, an SVG China map, draggable proposal archive, branching research constellation and artifact exhibition.

## Local preview

Run `python3 -m http.server 8000` in this directory, then open http://localhost:8000. No installation or build required.

## Deployment

The included GitHub Actions workflow deploys this directory to GitHub Pages. In repository Settings → Pages, select **GitHub Actions** as the source, then run the Deploy Dream Journey workflow if needed.

## Files

- `data.js`: fictional student project data
- `app.js`: map, gallery, journey, constellation and artifact viewer
- `style.css`: responsive paper-atlas design
- `index.html`: entry point
- `field.jpg`: illustrative landscape photograph from Unsplash

All student stories, quotes and handwritten-style artifacts are fictional demonstration content. The map is a stylized illustration, not an authoritative geographic dataset. This prototype uses browser-native JavaScript/CSS/SVG; there is no backend or data collection.
