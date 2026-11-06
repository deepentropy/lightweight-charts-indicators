/**
 * Quant Z-Score Squeeze [Gold Edition] (Quant VWAP System 3.8)
 *
 * Momentum line: the z-score of the close against its SMA over `len` bars, (close - sma) / stdev. Its colour has four
 * states: above zero and rising (bull strong) or falling (bull weak), below zero and rising (bear weak) or falling
 * (bear strong). Squeeze: the band width 4 * stdev / sma is compared with its own history, by the z-score over
 * `lookback` bars (Quant), by the ratio to its 20-bar SMA (Classic), or by both (Hybrid: Classic or z-score < -1).
 * Squeeze dots on zero mark `minSqueeze` squeeze bars in a row; a diamond marks the first bar after a squeeze. Zones
 * between 2 and 3 and between -2 and -3 are filled.
 * Alerts (alertcondition, `alerts` of the result): 'Squeeze Fired', true on the bars of the diamonds.
 *
 * Reference: "Quant Z-Score Squeeze [Gold Edition]" by CustomQuantLabs (published as "Quant VWAP System 3.8")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Squeeze Fired', message: 'Volatility Squeeze has fired!' },
];

export type QuantSqueezeModel = 'Smart Hybrid (Universal)' | 'Classic Ratio (Scalping)' | 'Quant Z-Score (Swing)';

export interface QuantVwapSystem38Inputs {
  /** Squeeze model */
  squeezeMethod: QuantSqueezeModel;
  /** Lookback of the band width z-score */
  lookback: number;
  /** Quant threshold (sigma) */
  zThresh: number;
  /** Classic threshold (ratio) */
  ratioThresh: number;
  /** Min squeeze bars */
  minSqueeze: number;
  /** Price length (SMA / stdev of the close) */
  len: number;
  bullStrong: string;
  bullWeak: string;
  bearStrong: string;
  bearWeak: string;
  /** Squeeze dot colour */
  squeezeColor: string;
  /** Zero line colour */
  zeroColor: string;
}

export const defaultInputs: QuantVwapSystem38Inputs = {
  squeezeMethod: 'Smart Hybrid (Universal)',
  lookback: 100,
  zThresh: -0.8,
  ratioThresh: 0.8,
  minSqueeze: 1,
  len: 20,
  bullStrong: '#00ffbb',
  bullWeak: '#005a42',
  bearStrong: '#ff1100',
  bearWeak: '#800000',
  squeezeColor: color.yellow,
  zeroColor: String(color.new('#00ffbb', 30)),
};

export const inputConfig: InputConfig[] = [
  { id: 'squeezeMethod', type: 'string', title: 'Squeeze Model', defval: 'Smart Hybrid (Universal)',
    options: ['Smart Hybrid (Universal)', 'Classic Ratio (Scalping)', 'Quant Z-Score (Swing)'] },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 100 },
  { id: 'zThresh', type: 'float', title: 'Quant Threshold (Sigma)', defval: -0.8, step: 0.1 },
  { id: 'ratioThresh', type: 'float', title: 'Classic Threshold (Ratio)', defval: 0.8, step: 0.05 },
  { id: 'minSqueeze', type: 'int', title: 'Min Squeeze Bars', defval: 1, min: 1,
    tooltip: 'Increase to 2 or 3 to filter out single-dot noise.' },
  { id: 'len', type: 'int', title: 'Price Length', defval: 20 },
  { id: 'bullStrong', type: 'color', title: 'Bull Strong', defval: '#00ffbb' },
  { id: 'bullWeak', type: 'color', title: 'Bull Weak', defval: '#005a42' },
  { id: 'bearStrong', type: 'color', title: 'Bear Strong', defval: '#ff1100' },
  { id: 'bearWeak', type: 'color', title: 'Bear Weak', defval: '#800000' },
  { id: 'squeezeColor', type: 'color', title: 'Squeeze Dot', defval: color.yellow },
  { id: 'zeroColor', type: 'color', title: 'Zero Glow', defval: String(color.new('#00ffbb', 30)) },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Base', color: String(color.new('#00ffbb', 30)), lineWidth: 3 },
  { id: 'plot1', title: 'Momentum', color: '#00ffbb', lineWidth: 2 },
  { id: 'plot2', title: 'Squeeze Active', color: color.yellow, lineWidth: 5, style: 'circles' },
];

const ZONE_LINE = String(color.new(color.gray, 100));

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_h2', price: 2, title: 'Top Zone Start', color: ZONE_LINE, linestyle: 'dashed' },
  { id: 'hline_h3', price: 3, title: 'Top Zone End', color: ZONE_LINE, linestyle: 'dashed' },
  { id: 'hline_l2', price: -2, title: 'Bot Zone Start', color: ZONE_LINE, linestyle: 'dashed' },
  { id: 'hline_l3', price: -3, title: 'Bot Zone End', color: ZONE_LINE, linestyle: 'dashed' },
];

/** fill(h2, h3, color.new(c_bear_strong, 85)) and fill(l2, l3, color.new(c_bull_strong, 85)) with the default colours */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bear', plot1: 'hline_h2', plot2: 'hline_h3', color: String(color.new('#ff1100', 85)), title: 'Bear Zone' },
  { id: 'fill_bull', plot1: 'hline_l2', plot2: 'hline_l3', color: String(color.new('#00ffbb', 85)), title: 'Bull Zone' },
];

export const metadata = {
  title: 'Quant Z-Score Squeeze [Gold Edition]',
  shortTitle: 'Quant Cycler',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/**
 * raw_bw = stdev * 4 / sma: na for sma = 0. Pine gives +infinity (stdev >= 0) or 0 / 0 = na there; both act the same
 * in its uses (`<` false, ta.sma / ta.stdev skip it, the bw z-score `<` tests false).
 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);
/** Pine na() / plots treat +-infinity as na */
const finite = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QuantRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  dev: WindowStdev;
  bwMean: WindowSma;
  bwDev: WindowStdev;
  bwAvg: WindowSma;
  sqSum: WindowSum;
  priceZ: number[];
  isValid: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  fired: boolean[];
  times: number[];
}

function study(inputs: Partial<QuantVwapSystem38Inputs>): BarStudy<QuantRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bearZone = String(color.new(cfg.bearStrong, 85));
  const bullZone = String(color.new(cfg.bullStrong, 85));
  return {
    init() {
      const sma = new WindowSma(cfg.len);
      const dev = new WindowStdev(cfg.len);
      const bwMean = new WindowSma(cfg.lookback);
      const bwDev = new WindowStdev(cfg.lookback);
      const bwAvg = new WindowSma(20);
      const sqSum = new WindowSum(cfg.minSqueeze);
      const s: QuantRun = {
        sma, dev, bwMean, bwDev, bwAvg, sqSum, priceZ: [], isValid: [], plot0: [], plot1: [], plot2: [], markers: [],
        fired: [], times: [],
        steps: [sma, dev, bwMean, bwDev, bwAvg, sqSum], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.times];
      s.series = [s.priceZ, s.isValid, s.plot0, s.plot1, s.plot2, s.fired];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const vwapCurr = s.sma.step(close);
      const stdev = s.dev.step(close);
      // z-scores: a non-zero value / 0 stays +-infinity (the colour and squeeze comparisons use it), 0 / 0 is na
      const priceZ = (close - vwapCurr) / stdev;
      s.priceZ[i] = priceZ;

      const rawBw = div(stdev * 4, vwapCurr);
      const bwMean = s.bwMean.step(rawBw);
      const bwStdev = s.bwDev.step(rawBw);
      const bwRatioAvg = s.bwAvg.step(rawBw);

      const bwZ = (rawBw - bwMean) / bwStdev;
      const sqQuant = lt(bwZ, cfg.zThresh);
      const sqClassic = lt(rawBw, bwRatioAvg * cfg.ratioThresh);
      const sqHybrid = sqClassic || lt(bwZ, -1.0);
      const isSqueeze = cfg.squeezeMethod === 'Quant Z-Score (Swing)' ? sqQuant
        : cfg.squeezeMethod === 'Classic Ratio (Scalping)' ? sqClassic : sqHybrid;
      // int(math.sum(is_squeeze ? 1 : 0, min_squeeze)) >= min_squeeze: na (false) on the first min_squeeze - 1 bars
      const sqCount = Math.trunc(s.sqSum.step(isSqueeze ? 1 : 0));
      const isValid = ge(sqCount, cfg.minSqueeze);
      s.isValid[i] = isValid;

      const up = i > 0 && gt(priceZ, s.priceZ[i - 1]);
      const positive = gt(priceZ, 0);
      const finalColor = positive ? (up ? cfg.bullStrong : cfg.bullWeak) : up ? cfg.bearWeak : cfg.bearStrong;

      // squeeze_fired = is_valid_squeeze[1] and not is_valid_squeeze (false on bar 0)
      const fired = i > 0 && s.isValid[i - 1] && !isValid;
      s.fired[i] = fired;
      if (fired) {
        // plotshape(squeeze_fired ? 0 : na, "Squeeze Fired", shape.diamond, location.absolute, color.white, size.tiny)
        s.markers.push({ time: b.time, position: 'atPriceMiddle', price: 0, shape: 'diamond', color: color.white,
          size: 'tiny' });
        s.times.push(b.time as number);
      }

      s.plot0[i] = { time: b.time, value: 0, color: cfg.zeroColor };
      s.plot1[i] = { time: b.time, value: finite(priceZ), color: finalColor };
      s.plot2[i] = { time: b.time, value: isValid ? 0 : NaN, color: cfg.squeezeColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 2, options: { title: 'Top Zone Start', color: ZONE_LINE, linestyle: 'dashed' } },
          { value: 3, options: { title: 'Top Zone End', color: ZONE_LINE, linestyle: 'dashed' } },
          { value: -2, options: { title: 'Bot Zone Start', color: ZONE_LINE, linestyle: 'dashed' } },
          { value: -3, options: { title: 'Bot Zone End', color: ZONE_LINE, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_h2', plot2: 'hline_h3', options: { title: 'Bear Zone' }, colors: new Array<string>(n).fill(bearZone) },
          { plot1: 'hline_l2', plot2: 'hline_l3', options: { title: 'Bull Zone' }, colors: new Array<string>(n).fill(bullZone) },
        ],
        markers: s.markers.slice(),
        // alertcondition(squeeze_fired, "Squeeze Fired")
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.fired[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QuantVwapSystem38Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QuantVwapSystem38Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QuantVwapSystem38 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
