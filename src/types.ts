/**
 * Marker data for candlestick pattern indicators and plotshape/plotchar/plotarrow
 */
export interface MarkerData {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square'
    | 'labelUp' | 'labelDown' | 'triangleUp' | 'triangleDown'
    | 'cross' | 'xcross' | 'diamond' | 'flag';
  color: string;
  text?: string;
  size?: number;
}

/**
 * Per-bar candle coloring (barcolor in PineScript)
 */
export interface BarColorData {
  time: number;
  color: string;
}

/**
 * Background coloring (bgcolor in PineScript)
 */
export interface BgColorData {
  time: number;
  color: string; // includes alpha
}

/**
 * Overlay candlestick data (plotcandle in PineScript)
 */
export interface PlotCandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  color?: string;
  borderColor?: string;
  wickColor?: string;
}

/**
 * Dynamic text labels (label.new in PineScript)
 */
export interface LabelData {
  time: number;
  price: number;
  text: string;
  color?: string;       // background color
  textColor?: string;
  style?: 'label_up' | 'label_down' | 'label_left' | 'label_right' | 'label_center';
  size?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
}

/**
 * Dynamic lines (line.new in PineScript)
 */
export interface LineDrawingData {
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  extend?: 'none' | 'left' | 'right' | 'both';
}

/**
 * Rectangular regions (box.new in PineScript)
 */
export interface BoxData {
  time1: number;
  price1: number;
  time2: number;
  price2: number;
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  text?: string;
  textColor?: string;
  textSize?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
  textHAlign?: 'left' | 'center' | 'right';
}

/**
 * Table cell data (table.new in PineScript)
 */
export interface TableCell {
  row: number;
  column: number;
  text: string;
  bgColor?: string;
  textColor?: string;
  textSize?: 'tiny' | 'small' | 'normal' | 'large' | 'huge';
}

/**
 * Data table (table.new in PineScript)
 */
export interface TableData {
  position: 'top_left' | 'top_center' | 'top_right'
    | 'middle_left' | 'middle_center' | 'middle_right'
    | 'bottom_left' | 'bottom_center' | 'bottom_right';
  columns: number;
  rows: number;
  cells: TableCell[];
}
