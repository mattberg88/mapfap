export type LL = { lat: number; lng: number };

export type Kind =
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "polygon"
  | "text"
  | "symbol";

export type SymbolStyle = "badge" | "pin" | "glyph";
export type TextStyle = "halo" | "box" | "plain";

export type Ann = {
  id: string;
  kind: Kind;
  pts: LL[];
  color: string;
  width: number;
  dashed?: boolean;
  fill?: boolean;
  // text
  text?: string;
  fontSize?: number;
  textStyle?: TextStyle;
  bold?: boolean;
  // symbol
  symbol?: string; // key in SYMBOLS, or "emoji:<char>"
  size?: number;
  symbolStyle?: SymbolStyle;
};

export type Tool =
  | "pan"
  | "select"
  | "pen"
  | "line"
  | "arrow"
  | "rect"
  | "ellipse"
  | "polygon"
  | "text"
  | "symbol"
  | "eraser";

export type Style = {
  color: string;
  width: number;
  dashed: boolean;
  fill: boolean;
  fontSize: number;
  textStyle: TextStyle;
  bold: boolean;
  symbol: string;
  size: number;
  symbolStyle: SymbolStyle;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
