# mapfap

Look around a map, draw on it, drop labels and symbols, and export a PNG or JPG — all in the browser.

## Features
- Search places (or paste `lat, lng`), locate me, pan and zoom
- Base maps: Streets, Satellite, Hybrid, Terrain, Light
- Tools: freehand, line, arrow, rectangle, circle/ellipse, area (polygon), labels, symbols & emoji, eraser, select/move
- Colors, line width, dashed lines, fills, label sizes and styles
- Drawings stick to the map as you pan and zoom
- Undo/redo, autosave in the browser, save/open project files (.json)
- Export PNG or JPG at 1×–3×, optional title, optional transparent background

## Keyboard
`H` move map · `V` select · `P` pen · `L` line · `A` arrow · `R` rectangle · `O` ellipse · `G` area · `T` label · `S` symbol · `E` eraser · `Del` delete · `Ctrl/Cmd+Z` undo · `Shift` square/circle

## Google Maps tiles
Without configuration the app uses free Esri tiles.
To use Google's tiles, create an API key with the **Map Tiles API** enabled and set it in Vercel:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-key
```

Restrict the key to your domain (HTTP referrer) in Google Cloud Console.

## Develop
```
npm install
npm run dev
```
