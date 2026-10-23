import L from "leaflet";

export type BaseId = "streets" | "satellite" | "hybrid" | "light" | "terrain";

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export const BASES: { id: BaseId; label: string }[] = [
  { id: "streets", label: "Streets" },
  { id: "satellite", label: "Satellite" },
  { id: "hybrid", label: "Hybrid" },
  { id: "terrain", label: "Terrain" },
  { id: "light", label: "Light" },
];

const common: L.TileLayerOptions = { crossOrigin: "anonymous", maxZoom: 21 };

// ---------- Google Map Tiles API (used when a key is configured) ----------
const sessions = new Map<string, Promise<string>>();
function googleSession(body: object): Promise<string> {
  const k = JSON.stringify(body);
  if (!sessions.has(k)) {
    sessions.set(
      k,
      fetch(`https://tile.googleapis.com/v1/createSession?key=${GOOGLE_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: k,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`Google tiles: ${r.status}`);
          return r.json();
        })
        .then((j) => j.session as string)
        .catch((e) => {
          sessions.delete(k);
          throw e;
        })
    );
  }
  return sessions.get(k)!;
}

async function googleLayers(id: BaseId): Promise<{ layers: L.TileLayer[]; attribution: string }> {
  const base = { language: "en-US", region: "US" };
  let body: object;
  if (id === "satellite") body = { ...base, mapType: "satellite" };
  else if (id === "hybrid") body = { ...base, mapType: "satellite", layerTypes: ["layerRoadmap"] };
  else if (id === "terrain") body = { ...base, mapType: "terrain", layerTypes: ["layerRoadmap"] };
  else if (id === "light")
    body = {
      ...base,
      mapType: "roadmap",
      styles: [
        { stylers: [{ saturation: -80 }, { lightness: 25 }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    };
  else body = { ...base, mapType: "roadmap" };
  const session = await googleSession(body);
  const layer = L.tileLayer(
    `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${GOOGLE_KEY}`,
    { ...common, maxNativeZoom: id === "terrain" ? 15 : 21, attribution: "Map data ©Google" }
  );
  return { layers: [layer], attribution: "Map data ©Google" };
}

// ---------- Free fallback (no key needed) ----------
const ESRI = "Imagery © Esri, Maxar, Earthstar Geographics";
const ESRI_MAP = "© Esri, HERE, Garmin, USGS, OpenStreetMap contributors";
function freeLayers(id: BaseId): { layers: L.TileLayer[]; attribution: string } {
  const esri = (svc: string, maxNative = 19) =>
    L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, {
      ...common,
      maxNativeZoom: maxNative,
    });
  switch (id) {
    case "satellite":
      return { layers: [esri("World_Imagery")], attribution: ESRI };
    case "hybrid":
      return {
        layers: [
          esri("World_Imagery"),
          esri("Reference/World_Transportation"),
          esri("Reference/World_Boundaries_and_Places"),
        ],
        attribution: `${ESRI}, HERE, Garmin`,
      };
    case "terrain":
      return { layers: [esri("World_Topo_Map")], attribution: ESRI_MAP };
    case "light":
      return {
        layers: [esri("Canvas/World_Light_Gray_Base", 16), esri("Canvas/World_Light_Gray_Reference", 16)],
        attribution: ESRI_MAP,
      };
    default:
      return { layers: [esri("World_Street_Map")], attribution: ESRI_MAP };
  }
}

export async function makeBase(id: BaseId) {
  if (GOOGLE_KEY) {
    try {
      return { ...(await googleLayers(id)), google: true };
    } catch (e) {
      console.warn("Google tiles unavailable, falling back", e);
    }
  }
  return { ...freeLayers(id), google: false };
}
