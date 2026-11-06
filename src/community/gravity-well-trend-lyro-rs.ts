/**
 * Gravity Well Trend | Lyro RS
 *
 * The centre is the volume-weighted mean of the source over `length` bars (SMA(src * volume) / SMA(volume)); the
 * distance is (src - centre) / ATR. Bands sit at +-bandMult ATR and +-bandMult / 2 ATR around the centre. The trend
 * flips by mode: 'Trend' when the distance passes +-mult with the centre rising / falling, 'Midline' with the source
 * above / below the centre, 'Bands' when the source crosses above the lowest band (long) or below the highest band
 * (short). The trend colours the centre glow; the centre line and the candles take a gradient from the faded to the
 * full trend colour by |distance| / bandMult. Gradient fills between the bands, labels on the flips.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Signal', 'Bearish Signal' and 'Any Signal', on the flips.
 *
 * Reference: "Gravity Well Trend | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LyroRS
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type GravityWellSignalMode = 'Trend' | 'Midline' | 'Bands';
export type GravityWellPalette = 'Classic' | 'Mystic' | 'Accented' | 'Royal';

export interface GravityWellTrendInputs {
  /** Source */
  src: SourceType;
  /** Signal mode */
  sigMode: GravityWellSignalMode;
  /** Window of the volume-weighted centre */
  length: number;
  /** Escape distance in ATR units ('Trend' mode) */
  mult: number;
  /** Width of the outer bands in ATR units (the inner bands are at half) */
  bandMult: number;
  /** ATR length */
  atrLen: number;
  /** Show the flip labels */
  showSignals: boolean;
  /** Show the bands */
  showBands: boolean;
  /** Colour the candles */
  candleColor: boolean;
  /** Colour palette */
  colMode: GravityWellPalette;
  /** Use the custom colours */
  useCustomPalette: boolean;
  customUp: string;
  customDown: string;
}

export const defaultInputs: GravityWellTrendInputs = {
  src: 'close',
  sigMode: 'Trend',
  length: 50,
  mult: 2.0,
  bandMult: 3.0,
  atrLen: 14,
  showSignals: true,
  showBands: true,
  candleColor: true,
  colMode: 'Mystic',
  useCustomPalette: false,
  customUp: '#00ff00',
  customDown: '#ff0000',
};

const SETTINGS = 'SETTINGS';
const FEATURES = 'FEATURES';
const COLOR = 'COLOR';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: SETTINGS },
  { id: 'sigMode', type: 'string', title: 'Signal Mode', defval: 'Trend', options: ['Trend', 'Midline', 'Bands'], group: SETTINGS },
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 5, group: SETTINGS },
  { id: 'mult', type: 'float', title: 'Escape Distance', defval: 2.0, min: 0.5, max: 5, step: 0.25, group: SETTINGS },
  { id: 'bandMult', type: 'float', title: 'Band Width', defval: 3.0, min: 0.5, max: 10, step: 0.25, group: SETTINGS },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: SETTINGS },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true, group: FEATURES },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: true, group: FEATURES },
  { id: 'candleColor', type: 'bool', title: 'Candle Coloring', defval: true, group: FEATURES },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic', options: ['Classic', 'Mystic', 'Accented', 'Royal'], group: COLOR, display: 'none' },
  { id: 'useCustomPalette', type: 'bool', title: 'Use Custom Palette', defval: false, group: COLOR, display: 'none' },
  { id: 'customUp', type: 'color', title: 'Custom Up', defval: '#00ff00', group: COLOR, display: 'none' },
  { id: 'customDown', type: 'color', title: 'Custom Down', defval: '#ff0000', group: COLOR, display: 'none' },
];

const UP_DEF = '#30FDCF';
const DN_DEF = '#E117B7';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center [Outer Glow]', color: String(color.new(UP_DEF, 90)), lineWidth: 10 },
  { id: 'plot1', title: 'Center [Glow]', color: String(color.new(UP_DEF, 78)), lineWidth: 5 },
  { id: 'plot2', title: 'Gravity Center', color: UP_DEF, lineWidth: 2 },
  { id: 'plot3', title: 'Highest Band', color: String(color.new(DN_DEF, 35)), lineWidth: 1 },
  { id: 'plot4', title: 'Upper Band', color: String(color.new(DN_DEF, 65)), lineWidth: 1 },
  { id: 'plot5', title: 'Lower Band', color: String(color.new(UP_DEF, 65)), lineWidth: 1 },
  { id: 'plot6', title: 'Lowest Band', color: String(color.new(UP_DEF, 35)), lineWidth: 1 },
];

export const metadata = {
  title: 'Gravity Well Trend | Lyro RS',
  shortTitle: 'Gravity Well | Lyro RS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface GravityVars {
  /** var int trend = 0 */
  trend: number;
  /** Last bar where src and bandLo / bandHi were both not na (ta.crossover / ta.crossunder) */
  pSrcLo: number;
  pLo: number;
  pSrcHi: number;
  pHi: number;
}

interface GravityRun extends BarRunState<GravityVars> {
  num: ReturnType<typeof taStep.sma>;
  den: ReturnType<typeof taStep.sma>;
  atr: ReturnType<typeof taStep.atr>;
  centerArr: number[];
  trendArr: number[];
  plots: Point[][];
  /** Gradient fill values: bandHi, bandHiM, center, bandLoM, bandLo (finite or NaN) */
  levels: number[][];
  markers: MarkerData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<GravityWellTrendInputs>): BarStudy<GravityRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // Palette
  let upC = cfg.colMode === 'Classic' ? '#00E676' : cfg.colMode === 'Mystic' ? '#30FDCF'
    : cfg.colMode === 'Accented' ? '#9618F7' : '#FFC107';
  let dnC = cfg.colMode === 'Classic' ? '#880E4F' : cfg.colMode === 'Mystic' ? '#E117B7'
    : cfg.colMode === 'Accented' ? '#FF0078' : '#673AB7';
  if (cfg.useCustomPalette) {
    upC = cfg.customUp;
    dnC = cfg.customDown;
  }
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const bandCols = [String(color.new(dnC, 35)), String(color.new(dnC, 65)), String(color.new(upC, 65)), String(color.new(upC, 35))];

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const num = taStep.sma();
      const den = taStep.sma();
      const atr = taStep.atr(cfg.atrLen);
      const s: GravityRun = {
        num, den, atr, centerArr: [], trendArr: [], plots: Array.from({ length: 7 }, () => []),
        levels: Array.from({ length: 5 }, () => []), markers: [], candles: [], flags: [[], [], []], times: [[], [], []],
        steps: [num, den, atr], vars: { trend: 0, pSrcLo: NaN, pLo: NaN, pSrcHi: NaN, pHi: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.centerArr, s.trendArr, ...s.plots, ...s.levels, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // Gravity engine
      const src = value(b);
      const vol = b.volume ?? NaN;
      // center = ta.sma(src * volume, length) / ta.sma(volume, length): a plain division (x / 0 is +-infinity)
      const center = s.num.step(src * vol, cfg.length) / s.den.step(vol, cfg.length);
      s.centerArr[i] = center;
      const atr = s.atr.step(b.high, b.low, b.close);
      const dist = (src - center) / atr;
      const bandHi = center + cfg.bandMult * atr;
      const bandHiM = center + cfg.bandMult * 0.5 * atr;
      const bandLoM = center - cfg.bandMult * 0.5 * atr;
      const bandLo = center - cfg.bandMult * atr;

      // Trend engine
      // ta.crossover(src, bandLo) / ta.crossunder(src, bandHi) run on every bar: compared with the last bar where both
      // values were not na (a tie there counts); exact comparisons (no tolerance)
      const reclaimUp = src > bandLo && v.pSrcLo <= v.pLo;
      const reclaimDn = src < bandHi && v.pSrcHi >= v.pHi;
      if (!isNaN(src) && !isNaN(bandLo)) {
        v.pSrcLo = src;
        v.pLo = bandLo;
      }
      if (!isNaN(src) && !isNaN(bandHi)) {
        v.pSrcHi = src;
        v.pHi = bandHi;
      }
      const prevCenter = i > 0 ? s.centerArr[i - 1] : NaN;
      let trend = v.trend;
      if (cfg.sigMode === 'Trend') {
        if (gt(dist, cfg.mult) && gt(center, prevCenter)) trend = 1;
        else if (lt(dist, -cfg.mult) && lt(center, prevCenter)) trend = -1;
      } else if (cfg.sigMode === 'Midline') {
        trend = gt(src, center) ? 1 : lt(src, center) ? -1 : trend;
      } else if (reclaimUp) {
        trend = 1;
      } else if (reclaimDn) {
        trend = -1;
      }
      v.trend = trend;
      s.trendArr[i] = trend;

      // Visuals
      const trendCol = trend === 1 ? upC : trend === -1 ? dnC : color.gray;
      // strength = math.min(math.abs(dist) / bandMult, 1.0); color.from_gradient(strength, 0, 1, color.new(trendCol, 65), trendCol)
      const strength = Math.min(Math.abs(dist) / cfg.bandMult, 1.0);
      const gradCol = String(color.from_gradient(strength, 0, 1, color.new(trendCol, 65), trendCol));
      const c = fin(center);
      const p = s.plots;
      // plot(center, 'Center [Outer Glow]', color.new(trendCol, 90), linewidth = 10, editable = false)
      p[0][i] = { time, value: c, color: String(color.new(trendCol, 90)) };
      // plot(center, 'Center [Glow]', color.new(trendCol, 78), linewidth = 5, editable = false)
      p[1][i] = { time, value: c, color: String(color.new(trendCol, 78)) };
      // plot(center, 'Gravity Center', gradCol, linewidth = 2)
      p[2][i] = { time, value: c, color: gradCol };
      const hi = fin(bandHi);
      const hiM = fin(bandHiM);
      const loM = fin(bandLoM);
      const lo = fin(bandLo);
      p[3][i] = { time, value: cfg.showBands ? hi : NaN, color: bandCols[0] };
      p[4][i] = { time, value: cfg.showBands ? hiM : NaN, color: bandCols[1] };
      p[5][i] = { time, value: cfg.showBands ? loM : NaN, color: bandCols[2] };
      p[6][i] = { time, value: cfg.showBands ? lo : NaN, color: bandCols[3] };
      s.levels[0][i] = hi;
      s.levels[1][i] = hiM;
      s.levels[2][i] = c;
      s.levels[3][i] = loM;
      s.levels[4][i] = lo;

      // flipUp = trend == 1 and trend[1] != 1 (trend[1] is na on the first bar: na != 1 is false)
      const flipUp = i > 0 && trend === 1 && s.trendArr[i - 1] !== 1;
      const flipDown = i > 0 && trend === -1 && s.trendArr[i - 1] !== -1;
      if (cfg.showSignals && flipUp) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: upC, text: '𝓛𝓸𝓷𝓰', textColor: '#000000', size: 'small' });
      }
      if (cfg.showSignals && flipDown) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: dnC, text: '𝓢𝓱𝓸𝓻𝓽', textColor: '#000000', size: 'small' });
      }
      // plotcandle(open, high, low, close, 'Candle Plot', candleColor ? gradCol : na, candleColor ? gradCol : na,
      //   bordercolor = candleColor ? gradCol : na, display = display.pane, force_overlay = true)
      const cc = cfg.candleColor ? gradCol : 'transparent';
      s.candles[i] = { time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: cc, wickColor: cc, borderColor: cc, forceOverlay: true };
      // alertcondition(flipUp) / alertcondition(flipDown) / alertcondition(flipUp or flipDown)
      const flags = [flipUp, flipDown, flipUp || flipDown];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      // fill(p1, p2, top_value, bottom_value, top_color, bottom_color)
      const grad = (p1: string, p2: string, top: number[], bottom: number[], topCol: string, bottomCol: string, title: string) => ({
        plot1: p1, plot2: p2, options: { title },
        gradient: {
          topValue: top.slice(), bottomValue: bottom.slice(),
          topColor: new Array<string | null>(n).fill(topCol), bottomColor: new Array<string | null>(n).fill(bottomCol),
        },
      });
      const [bandHi, bandHiM, center, bandLoM, bandLo] = s.levels;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          grad('plot3', 'plot4', bandHi, bandHiM, String(color.new(dnC, 58)), String(color.new(dnC, 91)), 'Upper Outer Zone'),
          grad('plot4', 'plot2', bandHiM, center, String(color.new(dnC, 91)), String(color.new(dnC, 99)), 'Upper Inner Zone'),
          grad('plot2', 'plot5', center, bandLoM, String(color.new(upC, 99)), String(color.new(upC, 91)), 'Lower Inner Zone'),
          grad('plot5', 'plot6', bandLoM, bandLo, String(color.new(upC, 91)), String(color.new(upC, 58)), 'Lower Outer Zone'),
        ],
        markers: s.markers.slice(),
        plotCandles: { candlePlot: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GravityWellTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GravityWellTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal', message: 'Gravity Well | Lyro RS: Bullish signal on {{ticker}} ({{interval}})' },
  { id: 'alert1', title: 'Bearish Signal', message: 'Gravity Well | Lyro RS: Bearish signal on {{ticker}} ({{interval}})' },
  { id: 'alert2', title: 'Any Signal', message: 'Gravity Well | Lyro RS: Signal flip on {{ticker}} ({{interval}})' },
];

export const GravityWellTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
