import type { Ann, LL } from "./types";
import { glyphPath } from "./symbols";

export type XY = [number, number];
export type Project = (p: LL) => XY;

const FONT = `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** True for light colors (white, yellow…) that need a dark outline to read on a map. */
export function isLight(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}
export function haloColor(hex: string) {
  return isLight(hex) ? "rgba(17,24,39,0.92)" : "rgba(255,255,255,0.95)";
}

function strokeStyle(ctx: CanvasRenderingContext2D, a: Ann) {
  ctx.strokeStyle = a.color;
  ctx.lineWidth = a.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(a.dashed ? [a.width * 2.2, a.width * 2.2] : []);
}

function smoothPath(ctx: CanvasRenderingContext2D, pts: XY[]) {
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length < 3) {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

export function textFont(a: Ann) {
  return `${a.bold ? 700 : 500} ${a.fontSize ?? 18}px ${FONT}`;
}

export function textBox(ctx: CanvasRenderingContext2D, a: Ann, P: Project) {
  const [x, y] = P(a.pts[0]);
  ctx.save();
  ctx.font = textFont(a);
  const lines = (a.text ?? "").split("\n");
  const fs = a.fontSize ?? 18;
  const lh = fs * 1.2;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 4);
  ctx.restore();
  const h = lh * lines.length;
  const pad = a.textStyle === "box" ? fs * 0.4 : fs * 0.15;
  return { x: x - w / 2 - pad, y: y - h / 2 - pad, w: w + pad * 2, h: h + pad * 2, lines, lh, cx: x, cy: y };
}

export function symbolBox(a: Ann, P: Project) {
  const [x, y] = P(a.pts[0]);
  const s = a.size ?? 32;
  if (a.symbolStyle === "pin" && !a.symbol?.startsWith("emoji:"))
    return { x: x - s / 2, y: y - s * 1.35, w: s, h: s * 1.35 };
  return { x: x - s / 2, y: y - s / 2, w: s, h: s };
}

function drawArrowHead(ctx: CanvasRenderingContext2D, from: XY, to: XY, a: Ann) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const len = Math.max(12, a.width * 3.6);
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = a.color;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - len * Math.cos(ang - 0.45), to[1] - len * Math.sin(ang - 0.45));
  ctx.lineTo(to[0] - len * Math.cos(ang + 0.45), to[1] - len * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawAnn(ctx: CanvasRenderingContext2D, a: Ann, P: Project, drafting = false) {
  ctx.save();
  const pts = a.pts.map(P);
  switch (a.kind) {
    case "pen": {
      strokeStyle(ctx, a);
      ctx.beginPath();
      if (pts.length === 1) {
        ctx.fillStyle = a.color;
        ctx.arc(pts[0][0], pts[0][1], a.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        smoothPath(ctx, pts);
        ctx.stroke();
      }
      break;
    }
    case "line":
    case "arrow": {
      strokeStyle(ctx, a);
      const [p0, p1] = pts;
      let end = p1;
      if (a.kind === "arrow") {
        // shorten the shaft so the round cap doesn't poke past the head
        const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        const back = Math.max(12, a.width * 3.6) * 0.7;
        end = [p1[0] - back * Math.cos(ang), p1[1] - back * Math.sin(ang)];
      }
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      if (a.kind === "arrow") drawArrowHead(ctx, p0, p1, a);
      break;
    }
    case "rect": {
      strokeStyle(ctx, a);
      const [p0, p1] = pts;
      const x = Math.min(p0[0], p1[0]);
      const y = Math.min(p0[1], p1[1]);
      const w = Math.abs(p1[0] - p0[0]);
      const h = Math.abs(p1[1] - p0[1]);
      if (a.fill) {
        ctx.fillStyle = hexA(a.color, 0.25);
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case "ellipse": {
      strokeStyle(ctx, a);
      const [p0, p1] = pts;
      ctx.beginPath();
      ctx.ellipse(
        (p0[0] + p1[0]) / 2,
        (p0[1] + p1[1]) / 2,
        Math.abs(p1[0] - p0[0]) / 2,
        Math.abs(p1[1] - p0[1]) / 2,
        0,
        0,
        Math.PI * 2
      );
      if (a.fill) {
        ctx.fillStyle = hexA(a.color, 0.25);
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case "polygon": {
      strokeStyle(ctx, a);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      if (!drafting) ctx.closePath();
      if (a.fill && !drafting) {
        ctx.fillStyle = hexA(a.color, 0.25);
        ctx.fill();
      }
      ctx.stroke();
      if (drafting) {
        ctx.fillStyle = "#fff";
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        for (const p of pts.slice(0, -1)) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      break;
    }
    case "text": {
      const b = textBox(ctx, a, P);
      const fs = a.fontSize ?? 18;
      ctx.font = textFont(a);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (a.textStyle === "box") {
        ctx.fillStyle = isLight(a.color) ? "rgba(17,24,39,0.9)" : "rgba(255,255,255,0.94)";
        ctx.strokeStyle = a.color;
        ctx.lineWidth = Math.max(1.5, fs / 12);
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, fs * 0.25);
        ctx.fill();
        ctx.stroke();
      }
      b.lines.forEach((line, i) => {
        const ly = b.cy - ((b.lines.length - 1) * b.lh) / 2 + i * b.lh;
        if (a.textStyle === "halo" || !a.textStyle) {
          ctx.strokeStyle = haloColor(a.color);
          ctx.lineWidth = Math.max(4, fs / 3.5);
          ctx.lineJoin = "round";
          ctx.strokeText(line, b.cx, ly);
        }
        ctx.fillStyle = a.color;
        ctx.fillText(line, b.cx, ly);
      });
      break;
    }
    case "symbol": {
      const [x, y] = pts[0];
      const s = a.size ?? 32;
      const sym = a.symbol ?? "dot";
      if (sym.startsWith("emoji:")) {
        ctx.font = `${s * 0.9}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 3;
        ctx.fillText(sym.slice(6), x, y + s * 0.04);
        break;
      }
      const g = glyphPath(sym);
      const style = a.symbolStyle ?? "badge";
      if (style === "glyph") {
        ctx.translate(x - s / 2, y - s / 2);
        ctx.scale(s / 24, s / 24);
        if (g) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.6;
          ctx.lineJoin = "round";
          ctx.stroke(g);
          ctx.fillStyle = a.color;
          ctx.fill(g, "evenodd");
        }
        break;
      }
      let cx = x,
        cy = y;
      const r = s / 2;
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = a.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(1.5, s / 14);
      ctx.beginPath();
      if (style === "pin") {
        cy = y - s * 0.85;
        // teardrop: circle centered at (cx, cy) with tip at (x, y)
        const t = Math.acos(r / (y - cy));
        ctx.moveTo(x, y);
        ctx.arc(cx, cy, r, Math.PI / 2 + t, Math.PI / 2 - t, false);
        ctx.closePath();
      } else {
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.stroke();
      if (g) {
        const gs = s * 0.68;
        ctx.translate(cx - gs / 2, cy - gs / 2);
        ctx.scale(gs / 24, gs / 24);
        ctx.fillStyle = "#fff";
        ctx.fill(g, "evenodd");
      }
      break;
    }
  }
  ctx.restore();
}

export function annBounds(ctx: CanvasRenderingContext2D, a: Ann, P: Project) {
  if (a.kind === "text") {
    const b = textBox(ctx, a, P);
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
  if (a.kind === "symbol") return symbolBox(a, P);
  const pts = a.pts.map(P);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = a.width / 2 + (a.kind === "arrow" ? a.width * 2 : 0);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

function distSeg(p: XY, a: XY, b: XY) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function inPoly(p: XY, pts: XY[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i],
      [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function hitTest(ctx: CanvasRenderingContext2D, a: Ann, P: Project, p: XY): boolean {
  const tol = a.width / 2 + 6;
  if (a.kind === "text" || a.kind === "symbol") {
    const b = annBounds(ctx, a, P);
    return p[0] >= b.x - 3 && p[0] <= b.x + b.w + 3 && p[1] >= b.y - 3 && p[1] <= b.y + b.h + 3;
  }
  const pts = a.pts.map(P);
  if (a.kind === "rect") {
    const [p0, p1] = pts;
    const c: XY[] = [p0, [p1[0], p0[1]], p1, [p0[0], p1[1]]];
    if (a.fill && inPoly(p, c)) return true;
    return c.some((q, i) => distSeg(p, q, c[(i + 1) % 4]) <= tol);
  }
  if (a.kind === "ellipse") {
    const [p0, p1] = pts;
    const cx = (p0[0] + p1[0]) / 2,
      cy = (p0[1] + p1[1]) / 2;
    const rx = Math.max(Math.abs(p1[0] - p0[0]) / 2, 1),
      ry = Math.max(Math.abs(p1[1] - p0[1]) / 2, 1);
    const d = Math.sqrt(((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2);
    if (a.fill && d <= 1) return true;
    return Math.abs(d - 1) * Math.min(rx, ry) <= tol;
  }
  if (a.kind === "polygon") {
    if (a.fill && inPoly(p, pts)) return true;
    return pts.some((q, i) => distSeg(p, q, pts[(i + 1) % pts.length]) <= tol);
  }
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= tol;
  for (let i = 0; i < pts.length - 1; i++) if (distSeg(p, pts[i], pts[i + 1]) <= tol) return true;
  return false;
}

export function drawSelection(ctx: CanvasRenderingContext2D, a: Ann, P: Project) {
  const b = annBounds(ctx, a, P);
  ctx.save();
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.restore();
}
