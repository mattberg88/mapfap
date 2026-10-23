"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { Ann, LL, Style, Tool } from "@/lib/types";
import { uid } from "@/lib/types";
import { drawAnn, drawSelection, hitTest, type XY } from "@/lib/draw";
import { BASES, type BaseId, makeBase } from "@/lib/basemaps";
import { SYMBOLS, EMOJI_PRESETS } from "@/lib/symbols";
import { Icon } from "./Icons";

const COLORS = ["#e11d48", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#2563eb", "#7c3aed", "#db2777", "#111827", "#ffffff"];

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "pan", label: "Move map", key: "H" },
  { id: "select", label: "Select / move", key: "V" },
  { id: "pen", label: "Freehand", key: "P" },
  { id: "line", label: "Line", key: "L" },
  { id: "arrow", label: "Arrow", key: "A" },
  { id: "rect", label: "Rectangle", key: "R" },
  { id: "ellipse", label: "Circle / ellipse", key: "O" },
  { id: "polygon", label: "Area (click points, double-click to finish)", key: "G" },
  { id: "text", label: "Label", key: "T" },
  { id: "symbol", label: "Symbol", key: "S" },
  { id: "eraser", label: "Eraser", key: "E" },
];

const DEFAULT_STYLE: Style = {
  color: "#e11d48",
  width: 4,
  dashed: false,
  fill: false,
  fontSize: 20,
  textStyle: "halo",
  bold: true,
  symbol: "star",
  size: 34,
  symbolStyle: "badge",
};

const LS_KEY = "mapfap:v1";

type TextEdit = { x: number; y: number; ll: LL; id?: string; value: string };

export default function Editor() {
  const mapEl = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayers = useRef<L.TileLayer[]>([]);
  const [attribution, setAttribution] = useState("");
  const [usingGoogle, setUsingGoogle] = useState(false);

  const [tool, setTool] = useState<Tool>("pan");
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [base, setBase] = useState<BaseId>("hybrid");
  const [anns, setAnns] = useState<Ann[]>([]);
  const annsRef = useRef<Ann[]>([]);
  annsRef.current = anns;
  const past = useRef<Ann[][]>([]);
  const future = useRef<Ann[][]>([]);
  const [, bumpHistory] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected;
  const draft = useRef<Ann | null>(null);
  const drag = useRef<
    | { mode: "move"; start: XY; orig: Ann; before: Ann[] }
    | { mode: "pan"; last: XY }
    | { mode: "draw" }
    | { mode: "erase"; before: Ann[]; erased: boolean }
    | null
  >(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 680);
  const [customEmoji, setCustomEmoji] = useState("");

  const flash = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout((flash as any)._t);
    (flash as any)._t = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---------- history ----------
  const commit = useCallback((next: Ann[], before = annsRef.current) => {
    past.current.push(before);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
    annsRef.current = next;
    setAnns(next);
    bumpHistory((n) => n + 1);
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(annsRef.current);
    setAnns(prev);
    setSelected(null);
    bumpHistory((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(annsRef.current);
    setAnns(next);
    bumpHistory((n) => n + 1);
  }, []);

  // ---------- projection ----------
  const P = useCallback((p: LL): XY => {
    const pt = mapRef.current!.latLngToContainerPoint([p.lat, p.lng]);
    return [pt.x, pt.y];
  }, []);
  const U = useCallback((xy: XY): LL => {
    const ll = mapRef.current!.containerPointToLatLng(L.point(xy[0], xy[1]));
    return { lat: ll.lat, lng: ll.lng };
  }, []);

  // ---------- render ----------
  const raf = useRef(0);
  const redraw = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const c = canvasRef.current;
      const map = mapRef.current;
      if (!c || !map) return;
      const ctx = c.getContext("2d")!;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      for (const a of annsRef.current) {
        if (textEditRef.current?.id === a.id) continue;
        drawAnn(ctx, a, P);
      }
      if (draft.current) drawAnn(ctx, draft.current, P, true);
      const sel = annsRef.current.find((a) => a.id === selectedRef.current);
      if (sel) drawSelection(ctx, sel, P);
    });
  }, [P]);
  const textEditRef = useRef<TextEdit | null>(null);
  textEditRef.current = textEdit;

  useEffect(redraw, [anns, selected, textEdit, redraw]);

  // ---------- map init ----------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    let saved: any = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    } catch {}
    const map = L.map(mapEl.current, {
      center: saved?.view?.center ?? [37.8044, -122.2712],
      zoom: saved?.view?.zoom ?? 13,
      zoomControl: false,
      zoomAnimation: false,
      maxZoom: 21,
      attributionControl: false,
      zoomSnap: 0.5,
      wheelPxPerZoomLevel: 90,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.scale({ position: "bottomleft" }).addTo(map);
    mapRef.current = map;
    if (saved?.anns) {
      annsRef.current = saved.anns;
      setAnns(saved.anns);
    }
    if (saved?.base) setBase(saved.base);
    map.on("move zoom resize viewreset", redraw);

    const c = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = mapEl.current!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = r.width + "px";
      c.style.height = r.height + "px";
      map.invalidateSize();
      redraw();
    });
    ro.observe(mapEl.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [redraw]);

  // ---------- basemap ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    makeBase(base).then(({ layers, attribution, google }) => {
      if (cancelled) return;
      baseLayers.current.forEach((l) => map.removeLayer(l));
      layers.forEach((l) => l.addTo(map));
      baseLayers.current = layers;
      setAttribution(attribution);
      setUsingGoogle(google);
    });
    return () => {
      cancelled = true;
    };
  }, [base]);

  // ---------- autosave ----------
  useEffect(() => {
    const t = window.setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      const c = map.getCenter();
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({ anns, base, view: { center: [c.lat, c.lng], zoom: map.getZoom() } })
        );
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [anns, base]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const save = () => {
      const c = map.getCenter();
      try {
        const cur = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
        localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, view: { center: [c.lat, c.lng], zoom: map.getZoom() } }));
      } catch {}
    };
    map.on("moveend", save);
    return () => {
      map.off("moveend", save);
    };
  });

  // ---------- style changes apply to selection ----------
  const updateStyle = (patch: Partial<Style>) => {
    setStyle((s) => ({ ...s, ...patch }));
    const id = selectedRef.current;
    if (!id) return;
    const next = annsRef.current.map((a) => {
      if (a.id !== id) return a;
      const n: Ann = { ...a };
      if (patch.color !== undefined) n.color = patch.color;
      if (patch.width !== undefined) n.width = patch.width;
      if (patch.dashed !== undefined) n.dashed = patch.dashed;
      if (patch.fill !== undefined) n.fill = patch.fill;
      if (patch.fontSize !== undefined && a.kind === "text") n.fontSize = patch.fontSize;
      if (patch.textStyle !== undefined && a.kind === "text") n.textStyle = patch.textStyle;
      if (patch.bold !== undefined && a.kind === "text") n.bold = patch.bold;
      if (patch.symbol !== undefined && a.kind === "symbol") n.symbol = patch.symbol;
      if (patch.size !== undefined && a.kind === "symbol") n.size = patch.size;
      if (patch.symbolStyle !== undefined && a.kind === "symbol") n.symbolStyle = patch.symbolStyle;
      return n;
    });
    commit(next);
  };

  const selectedAnn = anns.find((a) => a.id === selected) ?? null;
  // When selecting something, reflect its style in the panel
  useEffect(() => {
    if (!selectedAnn) return;
    setStyle((s) => ({
      ...s,
      color: selectedAnn.color,
      width: selectedAnn.width,
      dashed: !!selectedAnn.dashed,
      fill: !!selectedAnn.fill,
      ...(selectedAnn.kind === "text"
        ? { fontSize: selectedAnn.fontSize ?? s.fontSize, textStyle: selectedAnn.textStyle ?? s.textStyle, bold: !!selectedAnn.bold }
        : {}),
      ...(selectedAnn.kind === "symbol"
        ? { symbol: selectedAnn.symbol ?? s.symbol, size: selectedAnn.size ?? s.size, symbolStyle: selectedAnn.symbolStyle ?? s.symbolStyle }
        : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ---------- pointer handling on the drawing canvas ----------
  const local = (e: { clientX: number; clientY: number }): XY => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const hitAt = (p: XY) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const list = annsRef.current;
    for (let i = list.length - 1; i >= 0; i--) if (hitTest(ctx, list[i], P, p)) return list[i];
    return null;
  };

  const newAnn = (kind: Ann["kind"], pts: LL[]): Ann => ({
    id: uid(),
    kind,
    pts,
    color: style.color,
    width: style.width,
    dashed: style.dashed,
    fill: style.fill,
  });

  const finishPolygon = () => {
    const d = draft.current;
    if (!d || d.kind !== "polygon") return;
    const pts = d.pts.slice(0, -1);
    draft.current = null;
    if (pts.length >= 3) commit([...annsRef.current, { ...d, pts }]);
    else if (pts.length === 2) commit([...annsRef.current, { ...d, kind: "line", pts }]);
    redraw();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const p = local(e);
    const ll = U(p);
    if (textEdit) {
      commitText();
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    switch (tool) {
      case "select": {
        const hit = hitAt(p);
        if (hit) {
          setSelected(hit.id);
          drag.current = { mode: "move", start: p, orig: hit, before: annsRef.current };
        } else {
          setSelected(null);
          drag.current = { mode: "pan", last: p };
        }
        break;
      }
      case "eraser": {
        const before = annsRef.current;
        const hit = hitAt(p);
        if (hit) {
          annsRef.current = before.filter((a) => a.id !== hit.id);
          setAnns(annsRef.current);
        }
        drag.current = { mode: "erase", before, erased: !!hit };
        break;
      }
      case "pen":
        draft.current = newAnn("pen", [ll]);
        drag.current = { mode: "draw" };
        break;
      case "line":
      case "arrow":
      case "rect":
      case "ellipse":
        draft.current = newAnn(tool, [ll, ll]);
        drag.current = { mode: "draw" };
        break;
      case "polygon": {
        const d = draft.current;
        if (!d) {
          draft.current = newAnn("polygon", [ll, ll]);
        } else {
          // click near the first point closes the shape
          const first = P(d.pts[0]);
          if (d.pts.length > 3 && Math.hypot(first[0] - p[0], first[1] - p[1]) < 10) {
            finishPolygon();
            return;
          }
          d.pts[d.pts.length - 1] = ll;
          d.pts.push(ll);
        }
        break;
      }
      case "text":
        setTextEdit({ x: p[0], y: p[1], ll, value: "" });
        break;
      case "symbol":
        commit([
          ...annsRef.current,
          {
            ...newAnn("symbol", [ll]),
            symbol: style.symbol,
            size: style.size,
            symbolStyle: style.symbolStyle,
          },
        ]);
        break;
    }
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    const d = drag.current;
    if (tool === "polygon" && draft.current) {
      draft.current.pts[draft.current.pts.length - 1] = U(p);
      redraw();
      return;
    }
    if (!d) return;
    if (d.mode === "pan") {
      mapRef.current!.panBy([d.last[0] - p[0], d.last[1] - p[1]], { animate: false });
      d.last = p;
      return;
    }
    if (d.mode === "move") {
      const dx = p[0] - d.start[0],
        dy = p[1] - d.start[1];
      const moved: Ann = {
        ...d.orig,
        pts: d.orig.pts.map((q) => {
          const s = P(q);
          return U([s[0] + dx, s[1] + dy]);
        }),
      };
      annsRef.current = annsRef.current.map((a) => (a.id === moved.id ? moved : a));
      setAnns(annsRef.current);
      return;
    }
    if (d.mode === "erase") {
      const hit = hitAt(p);
      if (hit) {
        annsRef.current = annsRef.current.filter((a) => a.id !== hit.id);
        setAnns(annsRef.current);
        d.erased = true;
      }
      return;
    }
    const dr = draft.current;
    if (!dr) return;
    const ll = U(p);
    if (dr.kind === "pen") {
      const last = P(dr.pts[dr.pts.length - 1]);
      if (Math.hypot(last[0] - p[0], last[1] - p[1]) > 2) dr.pts.push(ll);
    } else {
      let q = ll;
      if (e.shiftKey && (dr.kind === "rect" || dr.kind === "ellipse")) {
        const s = P(dr.pts[0]);
        const m = Math.max(Math.abs(p[0] - s[0]), Math.abs(p[1] - s[1]));
        q = U([s[0] + Math.sign(p[0] - s[0] || 1) * m, s[1] + Math.sign(p[1] - s[1] || 1) * m]);
      }
      dr.pts[1] = q;
    }
    redraw();
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "move") {
      if (annsRef.current !== d.before) commit(annsRef.current, d.before);
      return;
    }
    if (d.mode === "erase") {
      if (d.erased) commit(annsRef.current, d.before);
      return;
    }
    if (d.mode === "draw") {
      const dr = draft.current;
      draft.current = null;
      if (!dr) return;
      if (dr.kind !== "pen") {
        const [a, b] = dr.pts.map(P);
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 4) {
          redraw();
          return;
        }
      }
      commit([...annsRef.current, dr]);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "polygon") {
      // the two clicks of the double-click each added a point; drop the duplicate
      const d = draft.current;
      if (d && d.pts.length > 2) d.pts.pop();
      finishPolygon();
      return;
    }
    if (tool === "select") {
      const p = local(e);
      const hit = hitAt(p);
      if (hit?.kind === "text") {
        const [x, y] = P(hit.pts[0]);
        setTextEdit({ x, y, ll: hit.pts[0], id: hit.id, value: hit.text ?? "" });
      }
    }
  };

  // wheel zoom while a drawing tool is active
  const wheelAcc = useRef(0);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const map = mapRef.current!;
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < 60) return;
      const dir = wheelAcc.current < 0 ? 0.5 : -0.5;
      wheelAcc.current = 0;
      const r = c.getBoundingClientRect();
      map.setZoomAround(L.point(e.clientX - r.left, e.clientY - r.top), map.getZoom() + dir, { animate: false });
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, []);

  // ---------- text ----------
  const commitText = () => {
    const t = textEditRef.current;
    if (!t) return;
    textEditRef.current = null;
    setTextEdit(null);
    const value = t.value.trim();
    if (t.id) {
      const before = annsRef.current;
      const next = value
        ? before.map((a) => (a.id === t.id ? { ...a, text: value } : a))
        : before.filter((a) => a.id !== t.id);
      commit(next, before);
      return;
    }
    if (!value) return;
    commit([
      ...annsRef.current,
      {
        ...newAnn("text", [t.ll]),
        text: value,
        fontSize: style.fontSize,
        textStyle: style.textStyle,
        bold: style.bold,
      },
    ]);
  };

  // ---------- keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current) {
        e.preventDefault();
        commit(annsRef.current.filter((a) => a.id !== selectedRef.current));
        setSelected(null);
        return;
      }
      if (e.key === "Escape") {
        draft.current = null;
        setSelected(null);
        redraw();
        return;
      }
      if (e.key === "Enter" && draft.current?.kind === "polygon") {
        finishPolygon();
        return;
      }
      const t = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
      if (t) chooseTool(t.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const chooseTool = (t: Tool) => {
    if (draft.current?.kind === "polygon") finishPolygon();
    draft.current = null;
    if (t !== "select") setSelected(null);
    setTool(t);
    redraw();
  };

  // ---------- search ----------
  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
      mapRef.current!.setView([+m[1], +m[2]], 17);
      setResults([]);
      return;
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const j = await r.json();
      const list = j.map((x: any) => ({ name: x.display_name, lat: +x.lat, lng: +x.lon }));
      if (!list.length) flash("No places found");
      if (list.length === 1) goTo(list[0]);
      else setResults(list);
    } catch {
      flash("Search failed — check your connection");
    }
  };
  const goTo = (r: { lat: number; lng: number }) => {
    mapRef.current!.setView([r.lat, r.lng], 17);
    setResults([]);
  };
  const locate = () => {
    if (!navigator.geolocation) return flash("Location not available");
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current!.setView([pos.coords.latitude, pos.coords.longitude], 17),
      () => flash("Couldn't get your location")
    );
  };

  // ---------- project save / open ----------
  const saveProject = () => {
    const map = mapRef.current!;
    const c = map.getCenter();
    const blob = new Blob(
      [JSON.stringify({ app: "mapfap", version: 1, base, view: { center: [c.lat, c.lng], zoom: map.getZoom() }, anns }, null, 2)],
      { type: "application/json" }
    );
    download(blob, "map-project.json");
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const openProject = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.anns)) throw new Error();
      commit(j.anns);
      if (j.base) setBase(j.base);
      if (j.view) mapRef.current!.setView(j.view.center, j.view.zoom);
      flash("Project opened");
    } catch {
      flash("That file isn't a map project");
    }
  };
  const clearAll = () => {
    if (!anns.length) return;
    if (!confirm("Remove all drawings from the map?")) return;
    commit([]);
    setSelected(null);
  };

  // ---------- export ----------
  const [exp, setExp] = useState({ format: "png" as "png" | "jpeg", scale: 2, includeMap: true, title: "", quality: 0.92 });
  const doExport = async () => {
    const map = mapRef.current!;
    const container = mapEl.current!;
    const rect = container.getBoundingClientRect();
    const W = Math.round(rect.width),
      H = Math.round(rect.height);
    const s = exp.scale;
    const titleH = exp.title.trim() ? 56 : 0;
    const out = document.createElement("canvas");
    out.width = W * s;
    out.height = (H + titleH) * s;
    const ctx = out.getContext("2d")!;
    ctx.scale(s, s);
    if (exp.format === "jpeg" || exp.includeMap) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H + titleH);
    }
    if (titleH) {
      ctx.fillStyle = "#111827";
      ctx.font = `700 26px "Inter", system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(exp.title.trim(), 18, titleH / 2);
      ctx.translate(0, titleH);
    }
    if (exp.includeMap) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      ctx.imageSmoothingQuality = "high";
      const tiles = container.querySelectorAll<HTMLImageElement>(".leaflet-tile-pane img.leaflet-tile");
      tiles.forEach((img) => {
        if (!img.complete || !img.naturalWidth) return;
        const r = img.getBoundingClientRect();
        if (r.right < rect.left || r.left > rect.right || r.bottom < rect.top || r.top > rect.bottom) return;
        const op = parseFloat(getComputedStyle(img).opacity || "1");
        ctx.globalAlpha = isNaN(op) ? 1 : op;
        ctx.drawImage(img, r.left - rect.left, r.top - rect.top, r.width, r.height);
      });
      ctx.restore();
    }
    for (const a of annsRef.current) drawAnn(ctx, a, P);
    if (exp.includeMap && attribution) {
      ctx.font = `11px system-ui, sans-serif`;
      const tw = ctx.measureText(attribution).width;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(W - tw - 10, H - 18, tw + 10, 18);
      ctx.fillStyle = "#333";
      ctx.textBaseline = "middle";
      ctx.fillText(attribution, W - tw - 5, H - 9);
    }
    try {
      const blob: Blob | null = await new Promise((res) =>
        out.toBlob(res, exp.format === "png" ? "image/png" : "image/jpeg", exp.quality)
      );
      if (!blob) throw new Error("empty");
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const name = (exp.title.trim() || "map").replace(/[^\w-]+/g, "-").toLowerCase();
      download(blob, `${name}-${stamp}.${exp.format === "png" ? "png" : "jpg"}`);
      setShowExport(false);
    } catch (err) {
      console.error(err);
      flash("Export blocked: the map tiles didn't allow copying. Try another base map, or export without the map.");
    }
    void map;
  };

  const canvasActive = tool !== "pan";
  const cursor = useMemo(() => {
    switch (tool) {
      case "select":
        return "default";
      case "text":
        return "text";
      case "eraser":
        return "cell";
      default:
        return "crosshair";
    }
  }, [tool]);

  const showsStroke = !["text", "symbol", "pan", "eraser"].includes(tool) || (selectedAnn && !["text", "symbol"].includes(selectedAnn.kind));
  const showsFill = ["rect", "ellipse", "polygon"].includes(tool) || (selectedAnn && ["rect", "ellipse", "polygon"].includes(selectedAnn.kind));
  const showsText = tool === "text" || selectedAnn?.kind === "text";
  const showsSymbol = tool === "symbol" || selectedAnn?.kind === "symbol";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <Icon name="logo" />
          </span>
          mapfap
        </div>
        <form className="search" onSubmit={doSearch}>
          <Icon name="search" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a place or paste lat, lng"
            aria-label="Search a place"
          />
          {results.length > 0 && (
            <ul className="results">
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => goTo(r)}>
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
        <div className="basepick" role="radiogroup" aria-label="Base map">
          {BASES.map((b) => (
            <button key={b.id} className={base === b.id ? "on" : ""} onClick={() => setBase(b.id)} role="radio" aria-checked={base === b.id}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="ghost" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)">
            <Icon name="undo" />
          </button>
          <button className="ghost" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)">
            <Icon name="redo" />
          </button>
          <div className="menu">
            <button className="ghost" title="Project">
              <Icon name="more" />
            </button>
            <div className="menu-pop">
              <button onClick={saveProject}>Save project file</button>
              <button onClick={() => fileInput.current?.click()}>Open project file…</button>
              <button onClick={clearAll} className="danger">
                Clear all drawings
              </button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) openProject(f);
              e.target.value = "";
            }}
          />
          <button className="primary" onClick={() => setShowExport(true)}>
            <Icon name="download" /> Export
          </button>
        </div>
      </header>

      <div className="stage">
        <nav className="toolbar" aria-label="Tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? "on" : ""}
              onClick={() => chooseTool(t.id)}
              title={`${t.label} (${t.key})`}
              aria-label={t.label}
              aria-pressed={tool === t.id}
            >
              <Icon name={t.id} />
            </button>
          ))}
          <span className="sep" />
          <button onClick={locate} title="Go to my location" aria-label="Go to my location">
            <Icon name="locate" />
          </button>
        </nav>

        <div className="mapwrap">
          <div ref={mapEl} className="map" />
          <canvas
            ref={canvasRef}
            className="overlay"
            style={{ pointerEvents: canvasActive ? "auto" : "none", cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
          />
          {textEdit && (
            <textarea
              autoFocus
              className="textedit"
              style={{
                left: textEdit.x,
                top: textEdit.y,
                color: style.color,
                fontSize: style.fontSize,
                fontWeight: style.bold ? 700 : 500,
              }}
              value={textEdit.value}
              rows={Math.max(1, textEdit.value.split("\n").length)}
              placeholder="Label"
              onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                }
                if (e.key === "Escape") setTextEdit(null);
              }}
              onBlur={commitText}
            />
          )}
          {tool === "polygon" && <div className="hint">Click to add points · double-click or Enter to finish</div>}
          {tool === "pan" && anns.length === 0 && (
            <div className="hint">Find your spot, then pick a drawing tool on the left</div>
          )}
          <div className="attrib">{attribution}</div>
          {toast && <div className="toast">{toast}</div>}
        </div>

        <aside className={`panel ${panelOpen ? "" : "collapsed"}`}>
          <button className="panel-toggle" onClick={() => setPanelOpen((o) => !o)} aria-label="Toggle style panel">
            <Icon name={panelOpen ? "chev-right" : "chev-left"} />
          </button>
          <div className="panel-body">
            <h3>{selectedAnn ? "Selected" : "Style"}</h3>
            <div className="field">
              <label>Color</label>
              <div className="swatches">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`sw ${style.color === c ? "on" : ""}`}
                    style={{ background: c }}
                    onClick={() => updateStyle({ color: c })}
                    aria-label={c}
                  />
                ))}
                <label className="sw custom" title="Custom color">
                  <input type="color" value={style.color} onChange={(e) => updateStyle({ color: e.target.value })} />
                </label>
              </div>
            </div>

            {showsStroke && (
              <>
                <div className="field">
                  <label>
                    Line width <span>{style.width}px</span>
                  </label>
                  <input type="range" min={1} max={24} value={style.width} onChange={(e) => updateStyle({ width: +e.target.value })} />
                </div>
                <div className="field row">
                  <button className={`chip ${!style.dashed ? "on" : ""}`} onClick={() => updateStyle({ dashed: false })}>
                    Solid
                  </button>
                  <button className={`chip ${style.dashed ? "on" : ""}`} onClick={() => updateStyle({ dashed: true })}>
                    Dashed
                  </button>
                  {showsFill && (
                    <button className={`chip ${style.fill ? "on" : ""}`} onClick={() => updateStyle({ fill: !style.fill })}>
                      Fill
                    </button>
                  )}
                </div>
              </>
            )}

            {showsText && (
              <>
                <div className="field">
                  <label>
                    Text size <span>{style.fontSize}px</span>
                  </label>
                  <input type="range" min={10} max={72} value={style.fontSize} onChange={(e) => updateStyle({ fontSize: +e.target.value })} />
                </div>
                <div className="field row">
                  {(["halo", "box", "plain"] as const).map((s) => (
                    <button key={s} className={`chip ${style.textStyle === s ? "on" : ""}`} onClick={() => updateStyle({ textStyle: s })}>
                      {s === "halo" ? "Outline" : s === "box" ? "Box" : "Plain"}
                    </button>
                  ))}
                  <button className={`chip ${style.bold ? "on" : ""}`} onClick={() => updateStyle({ bold: !style.bold })}>
                    <b>B</b>
                  </button>
                </div>
              </>
            )}

            {showsSymbol && (
              <>
                <div className="field">
                  <label>Symbol</label>
                  <div className="symgrid">
                    {Object.entries(SYMBOLS).map(([k, s]) => (
                      <button
                        key={k}
                        className={style.symbol === k ? "on" : ""}
                        onClick={() => updateStyle({ symbol: k })}
                        title={s.label}
                        aria-label={s.label}
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20">
                          <path d={s.d} fillRule="evenodd" fill="currentColor" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Emoji</label>
                  <div className="symgrid">
                    {EMOJI_PRESETS.map((em) => (
                      <button
                        key={em}
                        className={style.symbol === `emoji:${em}` ? "on" : ""}
                        onClick={() => updateStyle({ symbol: `emoji:${em}` })}
                        aria-label={em}
                      >
                        <span className="emoji">{em}</span>
                      </button>
                    ))}
                  </div>
                  <form
                    className="emoji-custom"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = customEmoji.trim();
                      if (v) updateStyle({ symbol: `emoji:${v}` });
                    }}
                  >
                    <input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} placeholder="Any emoji" maxLength={8} />
                    <button className="chip">Use</button>
                  </form>
                </div>
                {!style.symbol.startsWith("emoji:") && (
                  <div className="field row">
                    {(["badge", "pin", "glyph"] as const).map((s) => (
                      <button key={s} className={`chip ${style.symbolStyle === s ? "on" : ""}`} onClick={() => updateStyle({ symbolStyle: s })}>
                        {s === "badge" ? "Circle" : s === "pin" ? "Pin" : "Plain"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="field">
                  <label>
                    Size <span>{style.size}px</span>
                  </label>
                  <input type="range" min={16} max={96} value={style.size} onChange={(e) => updateStyle({ size: +e.target.value })} />
                </div>
              </>
            )}

            {selectedAnn && (
              <div className="field row">
                <button
                  className="chip danger"
                  onClick={() => {
                    commit(anns.filter((a) => a.id !== selectedAnn.id));
                    setSelected(null);
                  }}
                >
                  Delete
                </button>
                <button
                  className="chip"
                  onClick={() => {
                    const others = anns.filter((a) => a.id !== selectedAnn.id);
                    commit([...others, selectedAnn]);
                  }}
                >
                  Bring to front
                </button>
              </div>
            )}

            <p className="tips">
              {tool === "pan" && "Drag to look around. Scroll or pinch to zoom."}
              {tool === "select" && "Click a drawing to select it, drag to move. Double-click a label to edit. Delete key removes."}
              {tool === "pen" && "Drag to draw freehand."}
              {(tool === "line" || tool === "arrow") && "Drag from start to end."}
              {(tool === "rect" || tool === "ellipse") && "Drag to draw. Hold Shift for a square / circle."}
              {tool === "text" && "Click where the label goes, type, press Enter. Shift+Enter for a new line."}
              {tool === "symbol" && "Click on the map to drop the symbol."}
              {tool === "eraser" && "Click or drag over drawings to erase them."}
              {tool === "polygon" && "Outline an area point by point."}
              {" "}Scrolling zooms with any tool.
            </p>
            {!usingGoogle && (
              <p className="note">
                Using free Esri / OpenStreetMap maps. Add a Google Maps key (<code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>) to switch
                to Google tiles.
              </p>
            )}
          </div>
        </aside>
      </div>

      {showExport && (
        <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && setShowExport(false)}>
          <div className="modal" role="dialog" aria-label="Export image">
            <h2>Export image</h2>
            <p className="muted">Exports exactly what's in the map window right now.</p>
            <div className="field">
              <label>Title (optional)</label>
              <input className="text" value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} placeholder="e.g. Site plan – Oct 2026" />
            </div>
            <div className="field row">
              <button className={`chip ${exp.format === "png" ? "on" : ""}`} onClick={() => setExp({ ...exp, format: "png" })}>
                PNG
              </button>
              <button className={`chip ${exp.format === "jpeg" ? "on" : ""}`} onClick={() => setExp({ ...exp, format: "jpeg" })}>
                JPG
              </button>
            </div>
            <div className="field row">
              {[1, 2, 3].map((s) => (
                <button key={s} className={`chip ${exp.scale === s ? "on" : ""}`} onClick={() => setExp({ ...exp, scale: s })}>
                  {s}× size
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={exp.includeMap} onChange={(e) => setExp({ ...exp, includeMap: e.target.checked })} />
              Include the map underneath {exp.format === "png" && !exp.includeMap ? "(transparent background)" : ""}
            </label>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowExport(false)}>
                Cancel
              </button>
              <button className="primary" onClick={doExport}>
                <Icon name="download" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
