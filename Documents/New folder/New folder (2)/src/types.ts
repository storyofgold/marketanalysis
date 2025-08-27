export interface SymbolConfig {
  symbol: string;
  provider: string;
  description: string;
}

// Type definitions for SVG annotations
export interface SVGLine {
  type: 'line';
  x1: number; y1: number; x2: number; y2: number;
  color: string; strokeWidth: number;
}
export interface SVGRect {
  type: 'rect';
  x: number; y: number; width: number; height: number;
  color: string; fillOpacity: number;
}
export interface SVGText {
  type: 'text';
  x: number; y: number; text: string;
  color: string; fontSize: number;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type Annotation = SVGLine | SVGRect | SVGText;