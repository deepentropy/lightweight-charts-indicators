/**
 * Machine Learning RSI ║ BullVision
 *
 * An RSI (optionally smoothed with one of ten moving averages) blended with a k-nearest-neighbours estimate.
 * - Each bar is described by up to five features of the RSI, each scaled to 0..1 over the lookback: the RSI itself,
 *   its 3-bar momentum, its 10-bar standard deviation, its 5-bar regression slope and the 5-bar momentum of the close.
 * - The same features are computed for the `knnLookback` bars before, the Euclidean distance to the current bar is
 *   taken, and the `knnNeighbors` nearest bars give a weighted average (weight 1 / distance) of the RSI of the bar
 *   that followed each of them.
 * - Result = (1 - weight) * RSI + weight * estimate, kept in 0..100, then smoothed again (an exponential "Kalman"
 *   step, a double EMA or an ALMA).
 * As in the original, the features of the earlier bars are computed by function calls inside a loop, so the
 * functions with a memory (highest, lowest, standard deviation, regression, `x[n]` of a function argument) work on
 * the values that their call received on the earlier bars, not on the true history of that earlier bar
 * (`ta.highest` / `ta.lowest` in the loop: `callsite.highestByBar` / `lowestByBar`, several calls per bar).
 *
 * Outputs: the RSI line coloured by the trend (above / below 50) or by the impulse zones, the 50 level with a
 * gradient fill, the overbought and oversold levels, bar colours, and a table (mode, detected state, machine
 * learning on / off, thresholds) that is refreshed every 10 bars.
 *
 * Reference: "Machine Learning RSI ║ BullVision" by BullVisionCapital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, math, str, color, callsite, Series, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData, TableCellData, TableData } from '../types';

export interface MachineLearningRsiBullvisionInputs {
  rsiLength: number;
  useSmoothing: boolean;
  smoothingLength: number;
  maType: 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HMA' | 'LSMA' | 'ALMA';
  almaSigma: number;
  rsiOverbought: number;
  rsiOversold: number;
  useKnn: boolean;
  knnNeighbors: number;
  knnLookback: number;
  knnWeight: number;
  featureCount: number;
  useFilter: boolean;
  filterMethod: 'None' | 'Kalman' | 'DoubleEMA' | 'ALMA';
  filterStrength: number;
  neonEffect: boolean;
  colorScheme: 'Classic' | 'Deuteranopia' | 'Protanopia' | 'Tritanopia' | 'Monochrome';
  colorMode: 'None' | 'Trend Following' | 'Impulse';
}

export const defaultInputs: MachineLearningRsiBullvisionInputs = {
  rsiLength: 14,
  useSmoothing: true,
  smoothingLength: 3,
  maType: 'ALMA',
  almaSigma: 4,
  rsiOverbought: 70,
  rsiOversold: 30,
  useKnn: true,
  knnNeighbors: 5,
  knnLookback: 100,
  knnWeight: 0.4,
  featureCount: 3,
  useFilter: true,
  filterMethod: 'Kalman',
  filterStrength: 0.3,
  neonEffect: true,
  colorScheme: 'Classic',
  colorMode: 'Trend Following',
};

const G_RSI = '📊 ================ RSI Base Settings ================';
const G_THRESHOLD = '📏 ================ Threshold Settings ================';
const G_KNN = '🧠 ================ KNN Machine Learning ================';
const G_FILTER = '🔍 ================ Advanced Filtering ================';
const G_VISUAL = '🎨 ================ Visual Settings ================';

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: G_RSI },
  { id: 'useSmoothing', type: 'bool', title: 'Apply Moving Average', defval: true, group: G_RSI },
  { id: 'smoothingLength', type: 'int', title: 'MA Length', defval: 3, min: 1, group: G_RSI },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'ALMA',
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'WMA', 'VWMA', 'SMMA', 'HMA', 'LSMA', 'ALMA'], group: G_RSI },
  { id: 'almaSigma', type: 'int', title: 'ALMA Sigma', defval: 4, min: 1, group: G_RSI },
  { id: 'rsiOverbought', type: 'int', title: ' Overbought Level', defval: 70, min: 50, max: 100, group: G_THRESHOLD },
  { id: 'rsiOversold', type: 'int', title: ' Oversold Level', defval: 30, min: 0, max: 50, group: G_THRESHOLD },
  { id: 'useKnn', type: 'bool', title: 'Enable KNN Machine Learning', defval: true, group: G_KNN },
  { id: 'knnNeighbors', type: 'int', title: 'K - Number of Neighbors', defval: 5, min: 1, max: 50, group: G_KNN },
  { id: 'knnLookback', type: 'int', title: 'Historical Period for KNN', defval: 100, min: 20, max: 500, group: G_KNN },
  { id: 'knnWeight', type: 'float', title: 'ML Weight vs Standard RSI', defval: 0.4, min: 0.0, max: 1.0, step: 0.1, group: G_KNN },
  { id: 'featureCount', type: 'int', title: 'Number of Features', defval: 3, min: 1, max: 5, group: G_KNN,
    tooltip: 'Number of characteristics for finding similar market conditions' },
  { id: 'useFilter', type: 'bool', title: 'Apply Additional Smoothing', defval: true, group: G_FILTER },
  { id: 'filterMethod', type: 'string', title: 'Smoothing Method', defval: 'Kalman',
    options: ['None', 'Kalman', 'DoubleEMA', 'ALMA'], group: G_FILTER },
  { id: 'filterStrength', type: 'float', title: 'Smoothing Parameter', defval: 0.3, min: 0.01, max: 1.0, step: 0.01, group: G_FILTER },
  { id: 'neonEffect', type: 'bool', title: 'Neon Effect', defval: true, group: G_VISUAL, tooltip: 'Enable vibrant neon-like colors' },
  { id: 'colorScheme', type: 'string', title: 'Color Palette', defval: 'Classic',
    options: ['Classic', 'Deuteranopia', 'Protanopia', 'Tritanopia', 'Monochrome'], group: G_VISUAL },
  { id: 'colorMode', type: 'string', title: 'Coloring Mode', defval: 'Trend Following',
    options: ['None', 'Trend Following', 'Impulse'], group: G_VISUAL },
];

const NEON_BULL = String(color.rgb(0, 255, 187));
const NEON_BEAR = String(color.rgb(255, 17, 0));
const MID_COLOR = String(color.new(color.white, 70));
const BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI KNN', color: NEON_BULL, lineWidth: 3 },
  { id: 'plot1', title: '50 Level', color: MID_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Overbought Zone Top', color: NEON_BEAR, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Overbought Level', color: NEON_BEAR, lineWidth: 1 },
  { id: 'plot4', title: 'Overbought Zone Middle', color: BLUE, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Oversold Level', color: NEON_BULL, lineWidth: 1 },
  { id: 'plot6', title: 'Oversold Zone Bottom', color: NEON_BULL, lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Oversold Zone Middle', color: BLUE, lineWidth: 1, display: 'none' },
];

/** fill(rsiLine, midLine, ...): a gradient between the RSI and the 50 level */
export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'plot0', plot2: 'plot1', color: NEON_BULL, title: 'Plots Background' },
];

export const metadata = {
  title: ' Machine Learning RSI ║ BullVision',
  shortTitle: '🤖🧠 Machine Learning RSI ║ BullVision🤖🧠',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** tableColor = #160d0db3 */
const TABLE_COLOR = '#160d0db3';
const NO_COLOR = '#00000000';

/**
 * A ta.highest / ta.lowest call site with a fixed length, called several times per bar in a loop: the values of
 * callsite.highestByBar / lowestByBar, with the extreme of the earlier bars taken once per bar instead of on every
 * call (the loop calls it knnLookback times per bar). The site keeps the non-na value of the last call of each bar; a
 * call gives the extreme of the value of its bar (its own, or the one an earlier call kept when it is na) and the last
 * `length - 1` kept values of the earlier bars (`length` of them when its bar has none), the newest value winning a tie.
 */
function loopExtremeSite(isLowest: boolean, length: number): (barIndex: number, value: number) => number {
  const kept: number[] = [];
  const better = (a: number, b: number) => (isLowest ? a < b : a > b);
  let bar = NaN;
  let own = NaN; // value kept for the current bar
  let before = NaN; // extreme of the last length - 1 kept values of the earlier bars
  let beforeAll = NaN; // extreme of the last length kept values of the earlier bars
  return (barIndex, value) => {
    if (barIndex !== bar) {
      if (!Number.isNaN(own)) kept.push(own);
      bar = barIndex;
      own = NaN;
      before = NaN;
      beforeAll = NaN;
      for (let k = kept.length - 1, count = 0; k >= 0 && count < length; k--, count++) {
        const v = kept[k];
        if (count < length - 1 && (Number.isNaN(before) || better(v, before))) before = v;
        if (Number.isNaN(beforeAll) || better(v, beforeAll)) beforeAll = v;
      }
    }
    if (Number.isFinite(value)) own = value;
    if (barIndex < length - 1) return NaN;
    if (Number.isNaN(own)) return beforeAll;
    return !Number.isNaN(before) && better(before, own) ? before : own;
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MachineLearningRsiBullvisionInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const knnLookback = Math.trunc(cfg.knnLookback);
  const featureCount = Math.trunc(cfg.featureCount);
  const { knnWeight, filterStrength } = cfg;

  // Colours of the palette
  const [bullColor, bearColor] = ((): [string, string] => {
    switch (cfg.colorScheme) {
      case 'Classic':
        return [cfg.neonEffect ? NEON_BULL : String(color.rgb(0, 183, 18)), cfg.neonEffect ? NEON_BEAR : String(color.rgb(195, 0, 16))];
      case 'Deuteranopia': return [String(color.rgb(0, 170, 255)), String(color.rgb(255, 204, 0))];
      case 'Protanopia': return [String(color.rgb(0, 170, 230)), String(color.rgb(230, 175, 0))];
      case 'Tritanopia': return [String(color.rgb(255, 112, 0)), String(color.rgb(0, 33, 171))];
      default: return [String(color.rgb(222, 226, 230)), String(color.rgb(73, 80, 87))];
    }
  })();

  // Base RSI and its moving average
  const close = bars.map((b) => b.close);
  const baseRsiSeries = ta.rsi(new Series(bars, (b) => b.close), Math.trunc(cfg.rsiLength));
  const baseRsi = A(baseRsiSeries);
  const smoothedRsi = ((): number[] => {
    const length = Math.trunc(cfg.smoothingLength);
    const src = baseRsiSeries;
    switch (cfg.maType) {
      case 'SMA': return A(ta.sma(src, length));
      case 'EMA': return A(ta.ema(src, length));
      case 'DEMA': {
        const e1 = ta.ema(src, length);
        const a1 = A(e1);
        const a2 = A(ta.ema(e1, length));
        return a1.map((v, i) => 2 * v - a2[i]);
      }
      case 'TEMA': {
        const e1 = ta.ema(src, length);
        const e2 = ta.ema(e1, length);
        const a1 = A(e1);
        const a2 = A(e2);
        const a3 = A(ta.ema(e2, length));
        return a1.map((v, i) => 3 * (v - a2[i]) + a3[i]);
      }
      case 'WMA':
        // The loop of the script: weights length .. 1 on src[0] .. src[length - 1]
        return baseRsi.map((_v, i) => {
          let norm = 0;
          let sum = 0;
          for (let k = 0; k <= length - 1; k++) {
            const weight = length - k;
            norm += weight;
            sum += (i - k >= 0 ? baseRsi[i - k] : NaN) * weight;
          }
          return sum / norm;
        });
      case 'VWMA': return A(ta.vwma(src, length, new Series(bars, (b) => b.volume ?? NaN)));
      case 'SMMA': return A(ta.rma(src, length));
      case 'HMA': return A(ta.hma(src, length));
      case 'LSMA': return A(ta.linreg(src, length, 0));
      default: return A(ta.alma(src, length, 0.85, Math.trunc(cfg.almaSigma)));
    }
  })();
  const standardRsi = cfg.useSmoothing ? smoothedRsi : baseRsi;
  const rsiSeries = S(standardRsi);

  // normalize(source, length): min-max scaling; 0.5 on a zero (or na) range
  const scale = (source: number, maxVal: number, minVal: number): number => {
    const valueRange = maxVal - minVal;
    return Math.abs(valueRange) > EPS ? (source - minVal) / valueRange : 0.5;
  };
  const normalizeSeries = (source: number[]): number[] => {
    const s = S(source);
    const hi = A(ta.highest(s, knnLookback));
    const lo = A(ta.lowest(s, knnLookback));
    return source.map((v, i) => scale(v, hi[i], lo[i]));
  };

  // Features of the current bar
  const current: number[][] = [normalizeSeries(standardRsi)];
  if (featureCount >= 2) current.push(normalizeSeries(standardRsi.map((v, i) => v - (i >= 3 ? standardRsi[i - 3] : NaN))));
  if (featureCount >= 3) current.push(normalizeSeries(A(ta.stdev(rsiSeries, 10))));
  if (featureCount >= 4) {
    const l0 = A(ta.linreg(rsiSeries, 5, 0));
    const l1 = A(ta.linreg(rsiSeries, 5, 1));
    current.push(normalizeSeries(l0.map((v, i) => v - l1[i])));
  }
  if (featureCount >= 5) current.push(normalizeSeries(close.map((v, i) => v - (i >= 5 ? close[i - 5] : NaN))));

  // Features of the earlier bars: the same functions, called inside the loop over the lookback. Each call in the
  // source is one call site, which keeps one value per bar (the one of its last call on that bar).
  /** normalize() called in the loop: one ta.highest and one ta.lowest call site */
  const loopNormalize = () => {
    const hi = loopExtremeSite(false, knnLookback);
    const lo = loopExtremeSite(true, knnLookback);
    return (bar: number, source: number) => scale(source, hi(bar, source), lo(bar, source));
  };
  /**
   * getMomentum() called in the loop: `source[length]` reads the history of the argument, which keeps one value per
   * bar (the argument of the last call on that bar; a bar without a call shows the value of the bar before)
   */
  const loopMomentum = (length: number) => {
    const kept: number[] = [];
    return (bar: number, source: number) => {
      // bars since the last call: no call, the value before stays
      while (kept.length < bar) kept.push(kept.length > 0 ? kept[kept.length - 1] : NaN);
      const before = bar - length >= 0 ? kept[bar - length] : NaN;
      kept[bar] = source;
      return source - before;
    };
  };
  const norm1 = loopNormalize();
  const momentum2 = loopMomentum(3);
  const norm2 = loopNormalize();
  const stdev3 = callsite.stdev();
  const norm3 = loopNormalize();
  const linregA = callsite.linreg();
  const linregB = callsite.linreg();
  const norm4 = loopNormalize();
  const momentum5 = loopMomentum(5);
  const norm5 = loopNormalize();

  const mlRsi: number[] = new Array(n);
  const distances: number[] = [];
  const indices: number[] = [];
  const historical: number[] = [];
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
  const knnNeighbors = Math.trunc(cfg.knnNeighbors);

  for (let b = 0; b < n; b++) {
    let enhancedRsi = standardRsi[b];
    distances.length = 0;
    indices.length = 0;

    // Distances to the earlier bars
    for (let i = 1; i <= knnLookback; i++) {
      if (!(i < b)) continue;
      historical.length = 0;
      const past = at(standardRsi, b - i);
      historical.push(norm1(b, past));
      if (featureCount >= 2) historical.push(norm2(b, momentum2(b, past)));
      if (featureCount >= 3) historical.push(norm3(b, stdev3(b, past, 10)));
      if (featureCount >= 4) historical.push(norm4(b, linregA(b, past, 5, 0) - linregB(b, past, 5, 1)));
      if (featureCount >= 5) historical.push(norm5(b, momentum5(b, at(close, b - i))));

      // euclideanDistance(currentPoint, historicalPoint)
      let sum = 0;
      for (let f = 0; f < historical.length; f++) sum += math.pow(current[f][b] - historical[f], 2);
      distances.push(math.sqrt(sum));
      indices.push(i);
    }

    if (distances.length > 1) {
      // The bubble sort of the script (Pine comparison)
      for (let i = 0; i <= distances.length - 2; i++) {
        for (let j = 0; j <= distances.length - 2 - i; j++) {
          if (gt(distances[j], distances[j + 1])) {
            const tempDist = distances[j];
            distances[j] = distances[j + 1];
            distances[j + 1] = tempDist;
            const tempIdx = indices[j];
            indices[j] = indices[j + 1];
            indices[j + 1] = tempIdx;
          }
        }
      }

      let weightedSum = 0;
      let weightSum = 0;
      const effectiveK = Math.min(knnNeighbors, distances.length);
      for (let i = 0; i <= effectiveK - 1; i++) {
        const idx = indices[i];
        const dist = distances[i];
        const weight = lt(dist, 0.0001) ? 1.0 : 1.0 / dist;
        // idx < bar_index: always true for the stored bars
        const neighborRsi = at(standardRsi, b - (idx - 1));
        if (!isNaN(neighborRsi)) {
          weightedSum += neighborRsi * weight;
          weightSum += weight;
        }
      }
      if (gt(weightSum, 0.0)) {
        const knnRsi = weightedSum / weightSum;
        enhancedRsi = (1.0 - knnWeight) * standardRsi[b] + knnWeight * knnRsi;
        enhancedRsi = Math.max(0.0, Math.min(100.0, enhancedRsi));
      }
    }
    mlRsi[b] = cfg.useKnn ? enhancedRsi : standardRsi[b];
  }

  // Additional smoothing
  const filteredRsi = ((): number[] => {
    switch (cfg.filterMethod) {
      case 'None': return mlRsi;
      case 'Kalman': {
        let kfRsi = NaN;
        return mlRsi.map((v) => {
          kfRsi = isNaN(kfRsi) ? v : kfRsi + filterStrength * (v - kfRsi);
          return kfRsi;
        });
      }
      case 'DoubleEMA': {
        const ema1 = ta.ema(S(mlRsi), math.round(filterStrength * 10));
        return A(ta.ema(ema1, math.round(filterStrength * 5)));
      }
      case 'ALMA': return A(ta.alma(S(mlRsi), math.round(filterStrength * 20), 0, 6));
      default: return mlRsi;
    }
  })();
  const finalRsi = cfg.useFilter ? filteredRsi : mlRsi;

  const overbought = cfg.rsiOverbought;
  const oversold = cfg.rsiOversold;
  const WHITE = String(color.white);
  const GRAY = String(color.gray);
  const barBull = String(color.new(bullColor, 20));
  const barBear = String(color.new(bearColor, 20));

  const plot0: Array<{ time: number; value: number; color?: string }> = [];
  const topValue: number[] = [];
  const bottomValue: number[] = [];
  const topColor: Array<string | null> = [];
  const bottomColor: Array<string | null> = [];
  const barColors: BarColorData[] = [];
  const cells = new Map<string, TableCellData>();
  const cell = (column: number, row: number, text: string, bgColor: string) => {
    cells.set(`${column},${row}`, { column, row, text, textColor: WHITE, bgColor, textSize: 'auto' });
  };

  for (let i = 0; i < n; i++) {
    const v = finalRsi[i];
    const above = gt(v, 50);
    // color indicatorColor (na with the mode "None")
    let indicatorColor: string | null;
    if (cfg.colorMode === 'None') indicatorColor = null;
    else if (cfg.colorMode === 'Trend Following') indicatorColor = above ? bullColor : bearColor;
    else {
      indicatorColor = gt(v, overbought) ? bullColor : lt(v, oversold) ? bearColor : lt(v, 55) && gt(v, 45) ? WHITE : GRAY;
    }
    plot0.push({ time: bars[i].time, value: v, color: indicatorColor ?? 'transparent' });
    topValue.push(above ? v : 50);
    bottomValue.push(above ? 50 : v);
    topColor.push(cfg.neonEffect ? (above ? indicatorColor : NO_COLOR) : NO_COLOR);
    bottomColor.push(cfg.neonEffect ? (above ? NO_COLOR : indicatorColor) : NO_COLOR);
    barColors.push({ time: bars[i].time, color: above ? barBull : barBear });

    // Table, refreshed every 10 bars
    if (i % 10 === 0) {
      const context = cfg.colorMode === 'Trend Following'
        ? (above ? 'Bullish Trend' : 'Bearish Trend')
        : cfg.colorMode === 'Impulse'
          ? (gt(v, overbought) ? 'Bullish Impulse' : lt(v, oversold) ? 'Bearish Impulse' : 'None')
          : 'None';
      cell(0, 0, 'Mode', TABLE_COLOR);
      cell(1, 0, cfg.colorMode, TABLE_COLOR);
      cell(0, 1, 'Detected', TABLE_COLOR);
      cell(1, 1, context, TABLE_COLOR);
      cell(0, 2, 'Machine Learning', TABLE_COLOR);
      cell(1, 2, cfg.useKnn ? 'YES' : 'NO', TABLE_COLOR);
      cell(0, 3, 'OB/OS Thresholds', TABLE_COLOR);
      cell(1, 3, str.tostring(overbought) + ' / ' + str.tostring(oversold), String(color.new(color.black, 70)));
    }
  }

  const level = (value: number, css?: string) => bars.map((b) => ({ time: b.time, value, ...(css ? { color: css } : {}) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1: level(50, MID_COLOR),
      plot2: level(100, bearColor),
      plot3: level(overbought, bearColor),
      plot4: level((100 + overbought) / 2),
      plot5: level(oversold, bullColor),
      plot6: level(0, bullColor),
      plot7: level(oversold / 2),
    },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' },
        gradient: { topValue, bottomValue, topColor, bottomColor } },
    ],
    barColors,
    tables: n > 0 ? [{
      position: 'top_right', columns: 4, rows: 6, cells: [...cells.values()], bgColor: TABLE_COLOR,
      borderColor: TABLE_COLOR, borderWidth: 1, frameColor: '#ffffff', frameWidth: 1, forceOverlay: true,
    }] : [],
  };
}

export const MachineLearningRsiBullvision = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
