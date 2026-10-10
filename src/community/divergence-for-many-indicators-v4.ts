/**
 * Divergence for Many Indicators v4
 *
 * Looks for regular and hidden divergences between the price and up to 11 indicators: MACD, MACD histogram, RSI,
 * Stochastic, CCI, Momentum, OBV, volume weighted MACD, Chaikin Money Flow, Money Flow Index and an external source.
 * On each bar the last pivot lows (highs) of the price are tested: the indicator must be higher (lower) than at the
 * pivot while the price is lower (higher), or the reverse for a hidden divergence, and neither the indicator nor the
 * close may cross the straight line between the two points. Each divergence length draws one line on the price, and
 * a label lists the indicators and their count. Until a new pivot comes, the lines and the label of the last signal
 * on that side are replaced by the next signal.
 *
 * Reference: "Divergence for Many Indicators v4" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData } from '../types';

type LineStyleName = 'Solid' | 'Dashed' | 'Dotted';

export interface DivergenceForManyIndicatorsV4Inputs {
  pivotPeriod: number;
  source: 'Close' | 'High/Low';
  divergenceType: 'Regular' | 'Hidden' | 'Regular/Hidden';
  showNames: 'Full' | 'First Letter' | "Don't Show";
  /** Minimum number of divergences on a bar */
  showLimit: number;
  maxPivotPoints: number;
  maxBars: number;
  showNumber: boolean;
  showLast: boolean;
  dontConfirm: boolean;
  showLines: boolean;
  showPivot: boolean;
  calcMacd: boolean;
  calcMacdHist: boolean;
  calcRsi: boolean;
  calcStoch: boolean;
  calcCci: boolean;
  calcMom: boolean;
  calcObv: boolean;
  calcVwmacd: boolean;
  calcCmf: boolean;
  calcMfi: boolean;
  calcExternal: boolean;
  externalSource: string;
  posRegColor: string;
  negRegColor: string;
  posHidColor: string;
  negHidColor: string;
  posTextColor: string;
  negTextColor: string;
  regLineStyle: LineStyleName;
  hidLineStyle: LineStyleName;
  regLineWidth: number;
  hidLineWidth: number;
  showMas: boolean;
  ma1Color: string;
  ma2Color: string;
}

// Colours of the original script version: yellow, navy, lime, red, black, white
export const defaultInputs: DivergenceForManyIndicatorsV4Inputs = {
  pivotPeriod: 5,
  source: 'Close',
  divergenceType: 'Regular',
  showNames: 'Full',
  showLimit: 1,
  maxPivotPoints: 10,
  maxBars: 100,
  showNumber: true,
  showLast: false,
  dontConfirm: false,
  showLines: true,
  showPivot: false,
  calcMacd: true,
  calcMacdHist: true,
  calcRsi: true,
  calcStoch: true,
  calcCci: true,
  calcMom: true,
  calcObv: true,
  calcVwmacd: true,
  calcCmf: true,
  calcMfi: true,
  calcExternal: false,
  externalSource: 'close',
  posRegColor: '#FFEB3B',
  negRegColor: '#311B92',
  posHidColor: '#00E676',
  negHidColor: '#FF5252',
  posTextColor: '#363A45',
  negTextColor: '#FFFFFF',
  regLineStyle: 'Solid',
  hidLineStyle: 'Dashed',
  regLineWidth: 2,
  hidLineWidth: 1,
  showMas: false,
  ma1Color: '#00E676',
  ma2Color: '#FF5252',
};

const STYLES: LineStyleName[] = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'pivotPeriod', type: 'int', title: 'Pivot Period', defval: 5, min: 1, max: 50 },
  { id: 'source', type: 'string', title: 'Source for Pivot Points', defval: 'Close', options: ['Close', 'High/Low'] },
  { id: 'divergenceType', type: 'string', title: 'Divergence Type', defval: 'Regular', options: ['Regular', 'Hidden', 'Regular/Hidden'] },
  { id: 'showNames', type: 'string', title: 'Show Indicator Names', defval: 'Full', options: ['Full', 'First Letter', "Don't Show"] },
  { id: 'showLimit', type: 'int', title: 'Minimum Number of Divergence', defval: 1, min: 1, max: 11 },
  { id: 'maxPivotPoints', type: 'int', title: 'Maximum Pivot Points to Check', defval: 10, min: 1, max: 20 },
  { id: 'maxBars', type: 'int', title: 'Maximum Bars to Check', defval: 100, min: 30, max: 200 },
  { id: 'showNumber', type: 'bool', title: 'Show Divergence Number', defval: true },
  { id: 'showLast', type: 'bool', title: 'Show Only Last Divergence', defval: false },
  { id: 'dontConfirm', type: 'bool', title: "Don't Wait for Confirmation", defval: false },
  { id: 'showLines', type: 'bool', title: 'Show Divergence Lines', defval: true },
  { id: 'showPivot', type: 'bool', title: 'Show Pivot Points', defval: false },
  { id: 'calcMacd', type: 'bool', title: 'MACD', defval: true },
  { id: 'calcMacdHist', type: 'bool', title: 'MACD Histogram', defval: true },
  { id: 'calcRsi', type: 'bool', title: 'RSI', defval: true },
  { id: 'calcStoch', type: 'bool', title: 'Stochastic', defval: true },
  { id: 'calcCci', type: 'bool', title: 'CCI', defval: true },
  { id: 'calcMom', type: 'bool', title: 'Momentum', defval: true },
  { id: 'calcObv', type: 'bool', title: 'OBV', defval: true },
  { id: 'calcVwmacd', type: 'bool', title: 'VWmacd', defval: true },
  { id: 'calcCmf', type: 'bool', title: 'Chaikin Money Flow', defval: true },
  { id: 'calcMfi', type: 'bool', title: 'Money Flow Index', defval: true },
  { id: 'calcExternal', type: 'bool', title: 'Check External Indicator', defval: false },
  { id: 'externalSource', type: 'source', title: 'External Indicator', defval: 'close' },
  { id: 'posRegColor', type: 'color', title: 'Positive Regular Divergence', defval: '#FFEB3B' },
  { id: 'negRegColor', type: 'color', title: 'Negative Regular Divergence', defval: '#311B92' },
  { id: 'posHidColor', type: 'color', title: 'Positive Hidden Divergence', defval: '#00E676' },
  { id: 'negHidColor', type: 'color', title: 'Negative Hidden Divergence', defval: '#FF5252' },
  { id: 'posTextColor', type: 'color', title: 'Positive Divergence Text Color', defval: '#363A45' },
  { id: 'negTextColor', type: 'color', title: 'Negative Divergence Text Color', defval: '#FFFFFF' },
  { id: 'regLineStyle', type: 'string', title: 'Regular Divergence Line Style', defval: 'Solid', options: STYLES },
  { id: 'hidLineStyle', type: 'string', title: 'Hdden Divergence Line Style', defval: 'Dashed', options: STYLES },
  { id: 'regLineWidth', type: 'int', title: 'Regular Divergence Line Width', defval: 2, min: 1, max: 5 },
  { id: 'hidLineWidth', type: 'int', title: 'Hidden Divergence Line Width', defval: 1, min: 1, max: 5 },
  { id: 'showMas', type: 'bool', title: 'Show MAs 50 & 200', defval: false, inline: 'ma12' },
  { id: 'ma1Color', type: 'color', title: '', defval: '#00E676', inline: 'ma12' },
  { id: 'ma2Color', type: 'color', title: '', defval: '#FF5252', inline: 'ma12' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 50', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'MA 200', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'Divergence for Many Indicators v4',
  shortTitle: 'Divergence for Many Indicators v4',
  overlay: true,
};

/** study(max_lines_count = 400, max_labels_count = 400) */
const MAX_LINES = 400;
const MAX_LABELS = 400;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine nz() */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

const FULL_NAMES = ['MACD', 'Hist', 'RSI', 'Stoch', 'CCI', 'MOM', 'OBV', 'VWMACD', 'CMF', 'MFI', 'Extrn'];
const SHORT_NAMES = ['M', 'H', 'E', 'S', 'C', 'M', 'O', 'V', 'C', 'M', 'X'];
const LINE_STYLE = { Solid: 'solid', Dashed: 'dashed', Dotted: 'dotted' } as const;

interface Drawn<T> {
  data: T;
  deleted: boolean;
}

/** Live drawings in creation order: above max + 5 objects the oldest are deleted until max remain */
class Registry<T> {
  live: Array<Drawn<T>> = [];

  constructor(private max: number) {}

  create(data: T): Drawn<T> {
    const obj = { data, deleted: false };
    this.live.push(obj);
    if (this.live.length > this.max + 5) {
      for (const old of this.live.splice(0, this.live.length - this.max)) old.deleted = true;
    }
    return obj;
  }

  delete(obj: Drawn<T> | null): void {
    if (!obj || obj.deleted) return;
    obj.deleted = true;
    this.live.splice(this.live.indexOf(obj), 1);
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DivergenceForManyIndicatorsV4Inputs> = {},
): Omit<IndicatorResult, 'markers' | 'lines' | 'labels'> & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const prd = cfg.pivotPeriod;
  const maxpp = cfg.maxPivotPoints;
  const maxbars = cfg.maxBars;
  const useClose = cfg.source === 'Close';
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const volumeSeries = new Series(bars, (b) => b.volume ?? NaN);
  const close = bars.map((b) => b.close);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume ?? NaN);

  // Indicators
  const rsi = A(ta.rsi(closeSeries, 14));
  const [macdS, , histS] = ta.macd(closeSeries, 12, 26, 9);
  const macd = A(macdS);
  const deltamacd = A(histS);
  const moment = A(ta.mom(closeSeries, 10));
  const cci = A(ta.cci(closeSeries, 10));
  const obv = A(ta.obv(bars));
  const stk = A(ta.sma(ta.stoch(closeSeries, highSeries, lowSeries, 14), 3));
  const maFast = A(ta.vwma(closeSeries, 12, volumeSeries));
  const maSlow = A(ta.vwma(closeSeries, 26, volumeSeries));
  const vwmacd = maFast.map((v, i) => v - maSlow[i]);
  // Chaikin money flow: ((close - low) - (high - close)) / (high - low) * volume
  const cmfv = bars.map((_b, i) => ((close[i] - low[i] - (high[i] - close[i])) / (high[i] - low[i])) * volume[i]);
  const cmfNum = A(ta.sma(S(cmfv), 21));
  const cmfDen = A(ta.sma(volumeSeries, 21));
  const cmf = cmfNum.map((v, i) => v / cmfDen[i]);
  const mfi = A(ta.mfi(closeSeries, 14, volumeSeries));
  const external = bars.map((b) => {
    switch (cfg.externalSource) {
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
      case 'hlcc4': return (b.high + b.low + b.close + b.close) / 4;
      case 'volume': return b.volume ?? NaN;
      default: return b.close;
    }
  });
  const indicators: Array<[boolean, number[]]> = [
    [cfg.calcMacd, macd], [cfg.calcMacdHist, deltamacd], [cfg.calcRsi, rsi], [cfg.calcStoch, stk], [cfg.calcCci, cci],
    [cfg.calcMom, moment], [cfg.calcObv, obv], [cfg.calcVwmacd, vwmacd], [cfg.calcCmf, cmf], [cfg.calcMfi, mfi],
    [cfg.calcExternal, external],
  ];

  const names = cfg.showNames === 'Full' ? FULL_NAMES : SHORT_NAMES;
  const divColors = [cfg.posRegColor, cfg.negRegColor, cfg.posHidColor, cfg.negHidColor];
  const regStyle = LINE_STYLE[cfg.regLineStyle] ?? 'dotted';
  const hidStyle = LINE_STYLE[cfg.hidLineStyle] ?? 'dotted';
  const searchRegular = cfg.divergenceType === 'Regular' || cfg.divergenceType === 'Regular/Hidden';
  const searchHidden = cfg.divergenceType === 'Hidden' || cfg.divergenceType === 'Regular/Hidden';

  // Pivots of the price
  const ph = A(ta.pivothigh(useClose ? closeSeries : highSeries, prd, prd));
  const pl = A(ta.pivotlow(useClose ? closeSeries : lowSeries, prd, prd));
  const isPivot = (v: number) => !isNaN(v) && v !== 0; // `if ph`
  const maxArraySize = 20;
  const phPositions: number[] = new Array(maxArraySize).fill(0);
  const plPositions: number[] = new Array(maxArraySize).fill(0);
  const phVals: number[] = new Array(maxArraySize).fill(0);
  const plVals: number[] = new Array(maxArraySize).fill(0);

  const startpoint = cfg.dontConfirm ? 0 : 1; // the last candle is not checked without the option
  /** x[k] on bar i */
  const at = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);

  // Positive regular (cond 1) or negative hidden (cond 2) divergence on pivot lows: the length back to the pivot
  const positiveDivergence = (src: number[], cond: 1 | 2, i: number): number => {
    const prsc = useClose ? close : low;
    if (!(cfg.dontConfirm || gt(src[i], at(src, i, 1)) || gt(close[i], at(close, i, 1)))) return 0;
    for (let x = 0; x <= maxpp - 1; x++) {
      const len = i - plPositions[x] + prd;
      // an empty array element or a pivot too far back ends the search
      if (plPositions[x] === 0 || len > maxbars) break;
      const s0 = at(src, i, startpoint);
      const sLen = at(src, i, len);
      const p0 = at(prsc, i, startpoint);
      if (len > 5 && ((cond === 1 && gt(s0, sLen) && lt(p0, nz(plVals[x]))) || (cond === 2 && lt(s0, sLen) && gt(p0, nz(plVals[x]))))) {
        const slope1 = (s0 - sLen) / (len - startpoint);
        let virtualLine1 = s0 - slope1;
        const slope2 = (at(close, i, startpoint) - at(close, i, len)) / (len - startpoint);
        let virtualLine2 = at(close, i, startpoint) - slope2;
        let arrived = true;
        for (let y = 1 + startpoint; y <= len - 1; y++) {
          if (lt(at(src, i, y), virtualLine1) || lt(nz(at(close, i, y)), virtualLine2)) {
            arrived = false;
            break;
          }
          virtualLine1 -= slope1;
          virtualLine2 -= slope2;
        }
        if (arrived) return len;
      }
    }
    return 0;
  };

  // Negative regular (cond 1) or positive hidden (cond 2) divergence on pivot highs
  const negativeDivergence = (src: number[], cond: 1 | 2, i: number): number => {
    const prsc = useClose ? close : high;
    if (!(cfg.dontConfirm || lt(src[i], at(src, i, 1)) || lt(close[i], at(close, i, 1)))) return 0;
    for (let x = 0; x <= maxpp - 1; x++) {
      const len = i - phPositions[x] + prd;
      if (phPositions[x] === 0 || len > maxbars) break;
      const s0 = at(src, i, startpoint);
      const sLen = at(src, i, len);
      const p0 = at(prsc, i, startpoint);
      if (len > 5 && ((cond === 1 && lt(s0, sLen) && gt(p0, nz(phVals[x]))) || (cond === 2 && gt(s0, sLen) && lt(p0, nz(phVals[x]))))) {
        const slope1 = (s0 - sLen) / (len - startpoint);
        let virtualLine1 = s0 - slope1;
        const slope2 = (at(close, i, startpoint) - nz(at(close, i, len))) / (len - startpoint);
        let virtualLine2 = at(close, i, startpoint) - slope2;
        let arrived = true;
        for (let y = 1 + startpoint; y <= len - 1; y++) {
          if (gt(at(src, i, y), virtualLine1) || gt(nz(at(close, i, y)), virtualLine2)) {
            arrived = false;
            break;
          }
          virtualLine1 -= slope1;
          virtualLine2 -= slope2;
        }
        if (arrived) return len;
      }
    }
    return 0;
  };

  // Drawings
  type LineObj = Drawn<LineDrawingData> | null;
  type LabelObj = Drawn<LabelData>;
  const lineRegistry = new Registry<LineDrawingData>(MAX_LINES);
  const labelRegistry = new Registry<LabelData>(MAX_LABELS);
  const posDivLines: LineObj[] = [];
  const negDivLines: LineObj[] = [];
  const posDivLabels: LabelObj[] = [];
  const negDivLabels: LabelObj[] = [];
  const deleteOld = (lines: LineObj[]) => {
    for (const l of lines) lineRegistry.delete(l);
    lines.length = 0;
  };
  const deleteOldLabels = (labels: LabelObj[]) => {
    for (const l of labels) labelRegistry.delete(l);
    labels.length = 0;
  };
  // Deletes the lines and the label of the last signal, until a new pivot is met
  const deleteLast = (count: number, lines: LineObj[], labels: LabelObj[]) => {
    if (count > 0 && lines.length >= count) {
      for (let j = 1; j <= count; j++) lineRegistry.delete(lines.pop() ?? null);
      if (labels.length > 0) labelRegistry.delete(labels.pop() ?? null);
    }
  };
  let lastPosDivLines = 0;
  let lastNegDivLines = 0;
  let removeLastPosDivs = false;
  let removeLastNegDivs = false;

  const markers: MarkerData[] = [];
  const allDivergences: number[] = new Array(44).fill(NaN); // 11 indicators * 4 divergence types
  const namesShown = cfg.showNames !== "Don't Show";

  for (let i = 0; i < n; i++) {
    const isPh = isPivot(ph[i]);
    const isPl = isPivot(pl[i]);
    // plotshape(ph and showpivot, text = "H", style = shape.labeldown, offset = -prd), and "L" for the lows
    if (cfg.showPivot && i - prd >= 0) {
      if (isPh) {
        markers.push({ time: bars[i - prd].time, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255, 255, 255, 0)', text: 'H', textColor: '#FF5252' });
      }
      if (isPl) {
        markers.push({ time: bars[i - prd].time, position: 'belowBar', shape: 'labelUp', color: 'rgba(255, 255, 255, 0)', text: 'L', textColor: '#00E676' });
      }
    }
    // Positions (bar of the confirmation) and values of the pivots, newest first
    if (isPh) {
      phPositions.unshift(i);
      phVals.unshift(ph[i]);
      if (phPositions.length > maxArraySize) {
        phPositions.pop();
        phVals.pop();
      }
    }
    if (isPl) {
      plPositions.unshift(i);
      plVals.unshift(pl[i]);
      if (plPositions.length > maxArraySize) {
        plPositions.pop();
        plVals.pop();
      }
    }

    // The four divergence types of each indicator
    for (let k = 0; k < indicators.length; k++) {
      const [on, src] = indicators[k];
      allDivergences[k * 4] = on && searchRegular ? positiveDivergence(src, 1, i) : 0;
      allDivergences[k * 4 + 1] = on && searchRegular ? negativeDivergence(src, 1, i) : 0;
      allDivergences[k * 4 + 2] = on && searchHidden ? positiveDivergence(src, 2, i) : 0;
      allDivergences[k * 4 + 3] = on && searchHidden ? negativeDivergence(src, 2, i) : 0;
    }
    // Fewer divergences than the minimum: none is shown
    let totalDiv = 0;
    for (const d of allDivergences) totalDiv += Math.round(Math.sign(d));
    if (totalDiv < cfg.showLimit) allDivergences.fill(0);

    if (isPl) {
      removeLastPosDivs = false;
      lastPosDivLines = 0;
    }
    if (isPh) {
      removeLastNegDivs = false;
      lastNegDivLines = 0;
    }

    // Lines
    let textTop = '';
    let textBottom = '';
    const distances: number[] = [];
    let numTop = 0;
    let numBottom = 0;
    let topLabelColor = '#FFFFFF';
    let bottomLabelColor = '#FFFFFF';
    let oldPosDivsCanBeRemoved = true;
    let oldNegDivsCanBeRemoved = true;
    for (let x = 0; x <= 10; x++) {
      let divType = -1;
      for (let y = 0; y <= 3; y++) {
        const d = allDivergences[x * 4 + y];
        if (!(d > 0)) continue;
        divType = y;
        const bottomSide = y % 2 === 0;
        if (bottomSide) {
          numBottom++;
          bottomLabelColor = divColors[y];
        } else {
          numTop++;
          topLabelColor = divColors[y];
        }
        if (distances.includes(d)) continue; // one line per length
        distances.push(d);
        const price = useClose ? close : bottomSide ? low : high;
        const newLine: LineObj = cfg.showLines ? lineRegistry.create({
          time1: bars[i - d].time, price1: price[i - d], time2: bars[i - startpoint].time, price2: price[i - startpoint],
          color: divColors[y], style: y < 2 ? regStyle : hidStyle, width: y < 2 ? cfg.regLineWidth : cfg.hidLineWidth,
        }) : null;
        if (bottomSide) {
          if (oldPosDivsCanBeRemoved) {
            oldPosDivsCanBeRemoved = false;
            if (!cfg.showLast && removeLastPosDivs) {
              deleteLast(lastPosDivLines, posDivLines, posDivLabels);
              lastPosDivLines = 0;
            }
            if (cfg.showLast) deleteOld(posDivLines);
          }
          posDivLines.push(newLine);
          lastPosDivLines++;
          removeLastPosDivs = true;
        } else {
          if (oldNegDivsCanBeRemoved) {
            oldNegDivsCanBeRemoved = false;
            if (!cfg.showLast && removeLastNegDivs) {
              deleteLast(lastNegDivLines, negDivLines, negDivLabels);
              lastNegDivLines = 0;
            }
            if (cfg.showLast) deleteOld(negDivLines);
          }
          negDivLines.push(newLine);
          lastNegDivLines++;
          removeLastNegDivs = true;
        }
      }
      // Label text: the indicator goes to the side of its last divergence type
      if (divType >= 0 && namesShown) {
        if (divType % 2 === 1) textTop += names[x] + '\n';
        else textBottom += names[x] + '\n';
      }
    }

    // Labels
    if (namesShown || cfg.showNumber) {
      if (cfg.showNumber && numTop > 0) textTop += String(numTop);
      if (cfg.showNumber && numBottom > 0) textBottom += String(numBottom);
      if (textTop !== '') {
        if (cfg.showLast) deleteOldLabels(negDivLabels);
        negDivLabels.push(labelRegistry.create({
          time: bars[i].time, price: i > 0 ? Math.max(high[i], high[i - 1]) : NaN, text: textTop,
          color: topLabelColor, textColor: cfg.negTextColor, style: 'label_down',
        }));
      }
      if (textBottom !== '') {
        if (cfg.showLast) deleteOldLabels(posDivLabels);
        posDivLabels.push(labelRegistry.create({
          time: bars[i].time, price: i > 0 ? Math.min(low[i], low[i - 1]) : NaN, text: textBottom,
          color: bottomLabelColor, textColor: cfg.posTextColor, style: 'label_up',
        }));
      }
    }
  }

  // plot(showmas ? sma(close, 50) : na, color = showmas ? cma1col : na), and the same with 200
  const ma1 = cfg.showMas ? A(ta.sma(closeSeries, 50)) : null;
  const ma2 = cfg.showMas ? A(ta.sma(closeSeries, 200)) : null;
  const plots = {
    plot0: bars.map((b, i) => (ma1 ? { time: b.time, value: ma1[i], color: cfg.ma1Color } : { time: b.time, value: NaN })),
    plot1: bars.map((b, i) => (ma2 ? { time: b.time, value: ma2[i], color: cfg.ma2Color } : { time: b.time, value: NaN })),
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    lines: lineRegistry.live.map((l) => l.data),
    // a label with an na price is not drawn
    labels: labelRegistry.live.map((l) => l.data).filter((l) => !isNaN(l.price)),
  };
}

export const DivergenceForManyIndicatorsV4 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
