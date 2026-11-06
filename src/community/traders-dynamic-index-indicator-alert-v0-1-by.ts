/**
 * Traders Dynamic Index Indicator Alert (TDIALT)
 *
 * Traders Dynamic Index (TDI) on an RSI of the close: a volatility band (SMA of the RSI +/- 1.6185 standard
 * deviations over "lengthband" bars) with its middle line (MBL), the RSI price line (SMA 2 of the RSI) and the trade
 * signal line (SMA 7 of the RSI), with a fill between the two RSI lines (green when the price line is above).
 *
 * A Price Action Channel (smoothed moving average of the highs and of the lows) and an optional MACD direction
 * filter give the alert strength of each bar:
 * - long 1 / 2 / 3 (strong / medium / weak) when the price line is above the signal line, between the oversold and
 *   overbought levels, the high above the channel high and the bar rising; short 1 / 2 / 3 the same way down;
 * - the bar colour shows the strength (gold / aqua / blue for long, fuchsia / purple / black for short) up to the
 *   "Strength Level" input; optionally the other bars are gray;
 * - a dot at the bottom of the pane (drawn one bar back) marks the first alert bar of each sequence;
 * - optional spikes (100) on the first long / short signal of a run.
 *
 * Optionally every calculation uses Heikin Ashi candles of the chart.
 *
 * Reference: "Traders Dynamic Index Indicator Alert v1.3 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig,
  type FillData, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TradersDynamicIndexIndicatorAlertV01ByInputs {
  /** RSI length */
  lengthrsi: number;
  /** Volatility band length */
  lengthband: number;
  /** RSI price line length */
  lengthrsipl: number;
  /** Trade signal line length */
  lengthtradesl: number;
  /** Price Action Channel length */
  lenH: number;
  rsiOSL: number;
  rsiOBL: number;
  /** 1 strong only, 2 strong and medium, 3 all */
  strength: number;
  /** Gray bars when there is no alert */
  sgb: boolean;
  /** Colour the alert bars */
  sbr: boolean;
  /** Dots of the alert condition */
  sal: boolean;
  /** Heikin Ashi candles for all calculations */
  uha: boolean;
  /** Spikes on the first long / short signals */
  sspikes: boolean;
  umacd: boolean;
  fastMA: number;
  slowMA: number;
  signal: number;
}

export const defaultInputs: TradersDynamicIndexIndicatorAlertV01ByInputs = {
  lengthrsi: 13,
  lengthband: 34,
  lengthrsipl: 2,
  lengthtradesl: 7,
  lenH: 5,
  rsiOSL: 22,
  rsiOBL: 78,
  strength: 2,
  sgb: false,
  sbr: true,
  sal: true,
  uha: false,
  sspikes: false,
  umacd: false,
  fastMA: 8,
  slowMA: 16,
  signal: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthrsi', type: 'int', title: 'lengthrsi', defval: 13 },
  { id: 'lengthband', type: 'int', title: 'lengthband', defval: 34 },
  { id: 'lengthrsipl', type: 'int', title: 'lengthrsipl', defval: 2 },
  { id: 'lengthtradesl', type: 'int', title: 'lengthtradesl', defval: 7 },
  { id: 'lenH', type: 'int', title: 'Price Action Channel Length', defval: 5, min: 1 },
  { id: 'rsiOSL', type: 'int', title: 'RSI Oversold Level', defval: 22, min: 0, max: 49 },
  { id: 'rsiOBL', type: 'int', title: 'RSI Overbought Level', defval: 78, min: 51, max: 100 },
  { id: 'strength', type: 'int', title: 'Strength Level: (1)Strong (2)Medium (3)All', defval: 2, min: 1, max: 3, step: 1 },
  { id: 'sgb', type: 'bool', title: 'Check Box To Turn Bars Gray', defval: false },
  { id: 'sbr', type: 'bool', title: 'Highlight TDI Alert Bars', defval: true },
  { id: 'sal', type: 'bool', title: 'Show Alert Condition Status', defval: true },
  { id: 'uha', type: 'bool', title: 'Use Heikin Ashi Candles for Calculations', defval: false },
  { id: 'sspikes', type: 'bool', title: 'Show Spike LONG and SHORT Signals', defval: false },
  { id: 'umacd', type: 'bool', title: 'Use MACD Filtering', defval: false },
  { id: 'fastMA', type: 'int', title: 'MACD Fast MA Length', defval: 8, min: 2, active: { input: 'umacd' } },
  { id: 'slowMA', type: 'int', title: 'MACD Slow MA Length', defval: 16, min: 7, active: { input: 'umacd' } },
  { id: 'signal', type: 'int', title: 'MACD Signal Length', defval: 1, min: 1, active: { input: 'umacd' } },
];

// Pine v3 colour constants; plots without transp have the v3 default transparency 35 (alpha byte A6)
const BLUE35 = '#0000FFA6';
const ORANGE35 = '#FF7F00A6';
const GREEN35 = '#008000A6';
const RED35 = '#FF0000A6';
/** transp = 50 */
const BLUE50 = '#0000FF80';
const RED50 = '#FF000080';
/** fill(..., transp = 90) */
const FILL_GREEN = '#0080001A';
const FILL_RED = '#FF00001A';
const GOLD = '#FFD700';
const AQUA = '#00FFFF';
const BLUE = '#0000FF';
const FUCHSIA = '#FF00FF';
const PURPLE = '#800080';
const BLACK = '#000000';
const GRAY = '#808080';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VB Channel High', color: BLUE35, lineWidth: 2 },
  { id: 'plot1', title: 'VB Channel Low', color: BLUE35, lineWidth: 2 },
  { id: 'plot2', title: 'MBL', color: ORANGE35, lineWidth: 2 },
  { id: 'plot3', title: 'RSI PL', color: GREEN35, lineWidth: 2 },
  { id: 'plot4', title: 'TSL Signal', color: RED35, lineWidth: 2 },
  { id: 'plot5', title: 'LONG', color: BLUE50, lineWidth: 1 },
  { id: 'plot6', title: 'SHORT', color: RED50, lineWidth: 1 },
];

/** hline(rsiOSL / 50 / rsiOBL), the v3 default style (dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 22, color: '#FF0000', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline1', price: 50, color: BLACK, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline2', price: 78, color: '#00FF00', linestyle: 'dashed', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', title: 'Plots Background', palette: [FILL_GREEN, FILL_RED] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Alert Indicator', style: 'circle', location: 'bottom', color: '#3BB3E4', offset: -1 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bars Colours' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'TDIALT Alert', message: 'TDIALT Alert' },
  { id: 'alert1', title: 'TDIALT Long Alert', message: 'TDIALT Long' },
  { id: 'alert2', title: 'TDIALT Short Alert', message: 'TDIALT Short' },
];

export const metadata = {
  title: 'Traders Dynamic Index Indicator Alert v1.3 by JustUncleL',
  shortTitle: 'TDIALT',
  overlay: false,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = IndicatorResult & { barColors: BarColorData[]; alerts: AlertConditionState[] };

interface TdiVars {
  /** Counters of ta.rising(currMacd, 2) / ta.falling(currMacd, 2) */
  rise: number;
  fall: number;
  /** stateLong / stateShort of the bar before */
  stateLong: number;
  stateShort: number;
}

interface TdiRun extends BarRunState<TdiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: WindowSma;
  sd: WindowStdev;
  mab: WindowSma;
  mbb: WindowSma;
  smaH: WindowSma;
  smaL: WindowSma;
  fastE: ReturnType<typeof taStep.ema>;
  slowE: ReturnType<typeof taStep.ema>;
  haOpen: number[];
  haClose: number[];
  smmaH: number[];
  smmaL: number[];
  macd: number[];
  long: number[];
  short: number[];
  longA: boolean[];
  shortA: boolean[];
  cAlert: boolean[];
  plots: Point[][];
  fillColors: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TradersDynamicIndexIndicatorAlertV01ByInputs>): BarStudy<TdiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lenH = cfg.lenH;
  const strength = cfg.strength;
  return {
    init() {
      // the length checks of ta.sma and ta.stdev
      taStep.sma().step(0, cfg.lengthband);
      taStep.stdev().step(0, cfg.lengthband);
      taStep.sma().step(0, cfg.lengthrsipl);
      taStep.sma().step(0, cfg.lengthtradesl);
      taStep.sma().step(0, lenH);
      const s: TdiRun = {
        rsi: taStep.rsi(cfg.lengthrsi), ma: new WindowSma(cfg.lengthband), sd: new WindowStdev(cfg.lengthband),
        mab: new WindowSma(cfg.lengthrsipl), mbb: new WindowSma(cfg.lengthtradesl),
        smaH: new WindowSma(lenH), smaL: new WindowSma(lenH),
        fastE: taStep.ema(cfg.fastMA), slowE: taStep.ema(cfg.slowMA),
        haOpen: [], haClose: [], smmaH: [], smmaL: [], macd: [], long: [], short: [], longA: [], shortA: [], cAlert: [],
        plots: Array.from({ length: 7 }, () => []), fillColors: [], barColors: [], markers: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { rise: 0, fall: 0, stateLong: 0, stateShort: 0 }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.ma, s.sd, s.mab, s.mbb, s.smaH, s.smaL, s.fastE, s.slowE];
      s.lists = [s.barColors, s.markers, ...s.times];
      s.series = [s.haOpen, s.haClose, s.smmaH, s.smmaL, s.macd, s.long, s.short, s.longA, s.shortA, s.cAlert, ...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const time = bar.time;
      // security(heikinashi(tickerid), period, x) or security(ticker, period, x): the chart series itself
      let srcOpen = bar.open;
      let srcHigh = bar.high;
      let srcLow = bar.low;
      let srcClose = bar.close;
      if (cfg.uha) {
        const close = (bar.open + bar.high + bar.low + bar.close) / 4;
        const open = i > 0 ? (s.haOpen[i - 1] + s.haClose[i - 1]) / 2 : (bar.open + bar.close) / 2;
        s.haOpen[i] = open;
        s.haClose[i] = close;
        srcOpen = open;
        srcHigh = Math.max(bar.high, open, close);
        srcLow = Math.min(bar.low, open, close);
        srcClose = close;
      }

      const r = s.rsi.step(srcClose);
      const ma = s.ma.step(r);
      const sd = s.sd.step(r);
      const upZone = ma + 1.6185 * sd;
      const dnZone = ma - 1.6185 * sd;
      const mid = (upZone + dnZone) / 2;
      const a = s.mab.step(r);
      const b = s.mbb.step(r);

      // Price Action Channel: smma seeded with the sma (the sma call runs only while the previous value is na)
      const smaH = s.smaH.step(srcHigh);
      const smaL = s.smaL.step(srcLow);
      const pH = i > 0 ? s.smmaH[i - 1] : NaN;
      const pL = i > 0 ? s.smmaL[i - 1] : NaN;
      const smmaH = isNaN(pH) ? smaH : (pH * (lenH - 1) + srcHigh) / lenH;
      const smmaL = isNaN(pL) ? smaL : (pL * (lenH - 1) + srcLow) / lenH;
      s.smmaH[i] = smmaH;
      s.smmaL[i] = smmaL;

      // [currMacd, _, _] = macd(srcClose, fastMA, slowMA, signal)
      const currMacd = s.fastE.step(srcClose) - s.slowE.step(srcClose);
      s.macd[i] = currMacd;
      // rising / falling in the two ternary branches: in this version 3 script both keep the history of every bar
      // (measured on the reference: a history of only the bars of their branch gives other signals)
      const prevMacd = i > 0 ? s.macd[i - 1] : NaN;
      if (Number.isFinite(currMacd) && Number.isFinite(prevMacd)) {
        v.rise = gt(currMacd, prevMacd) ? v.rise + 1 : 0;
        v.fall = lt(currMacd, prevMacd) ? v.fall + 1 : 0;
      }
      // macdH == green
      const macdGreen = gt(currMacd, 0) ? v.rise >= 2 : !(v.fall >= 2);

      let l = 0;
      let sh = 0;
      if ((!cfg.umacd || macdGreen) && gt(a, b) && lt(a, cfg.rsiOBL) && gt(a, cfg.rsiOSL)
        && gt(srcHigh, smmaH) && gt(srcClose, srcOpen)) {
        l = gt(b, mid) ? 1 : gt(a, mid) && lt(b, mid) ? 2 : lt(a, mid) && lt(b, mid) ? 3 : 0;
      }
      if ((!cfg.umacd || !macdGreen) && lt(a, b) && lt(a, cfg.rsiOBL) && gt(a, cfg.rsiOSL)
        && lt(srcLow, smmaL) && lt(srcClose, srcOpen)) {
        sh = lt(b, mid) ? 1 : lt(a, mid) && gt(b, mid) ? 2 : gt(a, mid) && gt(b, mid) ? 3 : 0;
      }
      s.long[i] = l;
      s.short[i] = sh;

      const c = !cfg.sbr ? null
        : l === 1 ? GOLD : l === 2 && strength > 1 ? AQUA : l === 3 && strength > 2 ? BLUE
          : sh === 1 ? FUCHSIA : sh === 2 && strength > 1 ? PURPLE : sh === 3 && strength > 2 ? BLACK
            : cfg.sgb ? GRAY : null;
      if (c) s.barColors.push({ id: 'barcolor0', time, color: c });
      // long != long[1]: false on the first bar (na)
      const longA = l > 0 && i > 0 && l !== s.long[i - 1] && l <= strength;
      const shortA = sh > 0 && i > 0 && sh !== s.short[i - 1] && sh <= strength;
      s.longA[i] = longA;
      s.shortA[i] = shortA;
      s.cAlert[i] = longA || shortA;

      // Single alert state: stateLong_ = nz(stateLong[1]), counted after a signal of the bar before
      let sl = v.stateLong;
      let ss = v.stateShort;
      if (i > 0 && s.long[i - 1] > 0 && s.long[i - 1] <= strength) {
        sl = sl > 0 ? sl + 1 : 1;
        ss = 0;
      }
      if (i > 0 && s.short[i - 1] > 0 && s.short[i - 1] <= strength) {
        ss = ss > 0 ? ss + 1 : 1;
        sl = 0;
      }
      const spikeLong = cfg.sspikes ? (sl === 1 ? 100 : 0) : NaN;
      const spikeShort = cfg.sspikes ? (ss === 1 ? 100 : 0) : NaN;
      v.stateLong = sl > 0 ? sl + 1 : 0;
      v.stateShort = ss > 0 ? ss + 1 : 0;

      // plotshape(sal and c_alert[1], location.bottom, offset = -1): the dot of bar i - 1 is drawn on bar i - 1
      if (cfg.sal && i > 0 && s.cAlert[i - 1]) {
        const j = i - 1;
        const lj = s.long[j];
        const sj = s.short[j];
        const cj = lj === 1 ? GOLD : lj === 2 ? AQUA : lj === 3 ? BLUE : sj === 1 ? FUCHSIA : sj === 2 ? PURPLE : sj === 3 ? BLACK : null;
        if (cj) s.markers.push({ id: 'shape0', time: bars[j].time, position: 'bottom', shape: 'circle', color: cj });
      }

      const values = [upZone, dnZone, mid, a, b, spikeLong, spikeShort];
      for (let k = 0; k < 7; k++) s.plots[k][i] = { time, value: values[k] };
      s.fillColors[i] = gt(a, b) ? FILL_GREEN : FILL_RED;

      // alertcondition(x[1] and barstate.isnew): barstate.isnew is true on every historical bar
      const flags = [i > 0 && s.cAlert[i - 1], i > 0 && s.longA[i - 1], i > 0 && s.shortA[i - 1]];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const fills: FillData[] = [{
        id: 'fill0', plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' },
        colors: s.fillColors.slice(),
      }];
      const [plot0, plot1, plot2, plot3, plot4, plot5, plot6] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5, plot6 },
        hlines: [
          { id: 'hline0', value: cfg.rsiOSL, options: { color: '#FF0000', linestyle: 'dashed', linewidth: 1 } },
          { id: 'hline1', value: 50, options: { color: BLACK, linestyle: 'dashed', linewidth: 1 } },
          { id: 'hline2', value: cfg.rsiOBL, options: { color: '#00FF00', linestyle: 'dashed', linewidth: 1 } },
        ],
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TradersDynamicIndexIndicatorAlertV01ByInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TradersDynamicIndexIndicatorAlertV01ByInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TradersDynamicIndexIndicatorAlertV01By = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
};
