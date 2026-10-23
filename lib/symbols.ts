// Filled glyphs on a 24x24 grid (centered on 12,12). Drawn with the even-odd rule.
export const SYMBOLS: Record<string, { label: string; d: string }> = {
  dot: { label: "Dot", d: "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0Z" },
  star: {
    label: "Star",
    d: "M12 4l2.35 4.76 5.25.77-3.8 3.7.9 5.23L12 15.96 7.3 18.46l.9-5.23-3.8-3.7 5.25-.77Z",
  },
  flag: { label: "Flag", d: "M7 5h1.6v14H7Z M9.4 5H18l-2.2 3.2L18 11.4H9.4Z" },
  warning: { label: "Warning", d: "M10.9 5.5h2.2v8.5h-2.2Z M10.9 16h2.2v2.4h-2.2Z" },
  info: { label: "Info", d: "M10.9 10h2.2v8.5h-2.2Z M10.9 5.6h2.2v2.4h-2.2Z" },
  aid: { label: "First aid", d: "M10 5.5h4v4.5h4.5v4H14v4.5h-4V14H5.5v-4H10Z" },
  x: {
    label: "X",
    d: "M7.05 8.46l1.41-1.41L12 10.59l3.54-3.54 1.41 1.41L13.41 12l3.54 3.54-1.41 1.41L12 13.41l-3.54 3.54-1.41-1.41L10.59 12Z",
  },
  check: { label: "Check", d: "M5.6 12.4l1.5-1.5 3.3 3.3 6.5-6.5 1.5 1.5-8 8Z" },
  tent: { label: "Tent", d: "M12 5L19.5 18.5H4.5Z M12 11.5L14.3 18.5H9.7Z" },
  house: { label: "House", d: "M12 4.5l7.5 6.5h-2.3v7.5h-4v-4.5h-2.4v4.5h-4V11H4.5Z" },
  water: {
    label: "Water",
    d: "M12 4c3 4 5.2 6.6 5.2 9.3a5.2 5.2 0 0 1-10.4 0C6.8 10.6 9 8 12 4Z",
  },
  food: {
    label: "Food / cup",
    d: "M5.5 8h10v5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4Z M15.5 9h2a2.2 2.2 0 0 1 0 4.4h-2v-1.6h2a.6.6 0 0 0 0-1.2h-2Z",
  },
  power: { label: "Power", d: "M13.3 3.5L6 13.2h5l-1.3 7.3 7.3-9.8h-5Z" },
  trash: { label: "Trash", d: "M7.5 8.5h9l-1.1 10.5H8.6Z M6.5 6h11v1.6h-11Z M10 4.3h4V6h-4Z" },
  tree: { label: "Tree", d: "M12 3.8l5 7h-2.4l3.4 5H13v3.4h-2v-3.4H6l3.4-5H7Z" },
  car: {
    label: "Vehicle",
    d: "M5.5 11l1.6-4.2h9.8L18.5 11h.8v5.3h-2v2h-2.2v-2H8.9v2H6.7v-2h-2V11Z M7.5 13.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0Z M14.1 13.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0Z M7.6 10.4h8.8l-.9-2.4H8.5Z",
  },
  parking: {
    label: "Parking",
    d: "M8.5 5.5H13a3.75 3.75 0 0 1 0 7.5h-2.2v5.5H8.5Z M10.8 7.7v3.1H13a1.55 1.55 0 0 0 0-3.1Z",
  },
  person: {
    label: "Person",
    d: "M10 6.2a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z M8.8 9.2h6.4v5.6h-1.7v4.7h-3v-4.7H8.8Z",
  },
  heart: { label: "Heart", d: "M12 19.2l-6.2-6.1a3.6 3.6 0 0 1 6.2-4.6 3.6 3.6 0 0 1 6.2 4.6Z" },
  camera: {
    label: "Camera",
    d: "M4.5 8h3.2l1.6-2.2h5.4L16.3 8h3.2v10h-15Z M9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z",
  },
  up: { label: "Arrow", d: "M12 4.5l6.5 7.2h-4.3v6.8H9.8v-6.8H5.5Z" },
};

export const EMOJI_PRESETS = ["📍", "⛺", "🚻", "🚰", "🍲", "🔥", "🚧", "🅿️", "🏠", "🌳", "♿", "⚡"];

const cache = new Map<string, Path2D>();
export function glyphPath(key: string): Path2D | null {
  const s = SYMBOLS[key];
  if (!s) return null;
  let p = cache.get(key);
  if (!p) {
    p = new Path2D(s.d);
    cache.set(key, p);
  }
  return p;
}
