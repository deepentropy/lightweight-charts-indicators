/**
 * Candle Channel
 *
 * A channel around the SMA of the candle midpoint (high + low) / 2. The half width is the SMA of the candle height
 * (high - low) times `scale` / 100. Each half of the channel is split into 12 layers by hidden levels; the layers
 * are filled with the band colour, more transparent near the centre (gradient), or one solid fill covers the whole
 * channel. Signals: a bearish candle that closes back below the upper band after a close above it, a bullish candle
 * that closes back above the lower band after a close below it, and crosses of the close with the midpoint SMA.
 *
 * Reference: "Candle Channel" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CandleChannelInputs {
  /** SMA length of the candle midpoint and of the candle height */
  length: number;
  /** Band scaling (% of the average candle height) */
  scale: number;
  /** Channel fill: 'Gradient', 'Solid' or 'None' */
  fillType: 'Gradient' | 'Solid' | 'None';
  /** Upper band and upper gradient colour */
  colUpper: string;
  /** Lower band and lower gradient colour */
  colLower: string;
  /** Colour of the solid fill */
  solidFillColor: string;
  /** Show the band reversal signals */
  showReturnSignals: boolean;
  /** Lower band reversal signal colour */
  bullishSignalColor: string;
  /** Upper band reversal signal colour */
  bearishSignalColor: string;
  /** Show the SMA crossover signals */
  showSmaSignals: boolean;
  smaCrossUpColor: string;
  smaCrossDownColor: string;
}

export const defaultInputs: CandleChannelInputs = {
  length: 20,
  scale: 200.0,
  fillType: 'Gradient',
  colUpper: 'rgb(162, 16, 6)',
  colLower: 'rgb(6, 162, 47)',
  solidFillColor: color.gray,
  showReturnSignals: true,
  bullishSignalColor: color.green,
  bearishSignalColor: color.red,
  showSmaSignals: true,
  smaCrossUpColor: color.green,
  smaCrossDownColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'SMA Length for Candle Midpoint', defval: 20, min: 1 },
  { id: 'scale', type: 'float', title: 'Band Scaling (% of Average Candle Height)', defval: 200.0, min: 1.0, step: 1.0 },
  { id: 'fillType', type: 'string', title: 'Fill Type', defval: 'Gradient', options: ['Gradient', 'Solid', 'None'] },
  { id: 'colUpper', type: 'color', title: 'Upper Band and Gradient Color', defval: 'rgb(162, 16, 6)' },
  { id: 'colLower', type: 'color', title: 'Lower Band and Gradient Color', defval: 'rgb(6, 162, 47)' },
  { id: 'solidFillColor', type: 'color', title: 'Solid Fill Color', defval: color.gray },
  { id: 'showReturnSignals', type: 'bool', title: 'Show Band Reversal Signals', defval: true },
  { id: 'bullishSignalColor', type: 'color', title: 'Lower Band Reversal Signal Color', defval: color.green },
  { id: 'bearishSignalColor', type: 'color', title: 'Upper Band Reversal Signal Color', defval: color.red },
  { id: 'showSmaSignals', type: 'bool', title: 'Show SMA Crossover Signals', defval: true },
  { id: 'smaCrossUpColor', type: 'color', title: 'SMA Crossover Up Signal Color', defval: color.green },
  { id: 'smaCrossDownColor', type: 'color', title: 'SMA Crossover Down Signal Color', defval: color.red },
];

/** The 24 hidden gradient levels: 0..11 from the upper band to the centre, 12..23 from the centre to the lower band */
const LEVELS = 24;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Candle Midpoint SMA', color: String(color.new('#a5a7ad', 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: 'rgb(162, 16, 6)', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: 'rgb(6, 162, 47)', lineWidth: 1 },
  { id: 'plot3', title: 'Midpoint', color: '#2962FF', lineWidth: 1, display: 'none' },
  ...Array.from({ length: LEVELS }, (_v, k): PlotConfig => ({
    id: `plot${4 + k}`, title: `Gradient Level ${k}`, color: '#2962FF', lineWidth: 1, display: 'none',
  })),
];

export const metadata = {
  title: 'Candle Channel',
  shortTitle: 'Candle Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CandleRun extends BarRunState<Record<string, never>> {
  midSma: WindowSma;
  avgRange: WindowSma;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  upperBand: number[];
  lowerBand: number[];
  /** plot0..plot27 */
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<CandleChannelInputs>): BarStudy<CandleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CandleRun = {
        midSma: new WindowSma(cfg.length), avgRange: new WindowSma(cfg.length),
        crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        upperBand: [], lowerBand: [], plots: Array.from({ length: 4 + LEVELS }, () => []), markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.midSma, s.avgRange, s.crossUp, s.crossDown];
      s.lists = [s.markers];
      s.series = [s.upperBand, s.lowerBand, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // candleMid = (high + low) / 2; midSma = ta.sma(candleMid, length); avgRange = ta.sma(high - low, length)
      const midSma = s.midSma.step((b.high + b.low) / 2);
      const avgRange = s.avgRange.step(b.high - b.low);
      const offset = (avgRange * cfg.scale) / 100;
      const u = midSma + offset;
      const l = midSma - offset;
      s.upperBand[i] = u;
      s.lowerBand[i] = l;
      // ta.crossover(close, midSma) / ta.crossunder(close, midSma): run on every bar (left side of `and` is an input)
      const crossUp = s.crossUp.step(b.close, midSma);
      const crossDown = s.crossDown.step(b.close, midSma);

      const plots = s.plots;
      plots[0][i] = { time, value: midSma };
      plots[1][i] = { time, value: u, color: cfg.colUpper };
      plots[2][i] = { time, value: l, color: cfg.colLower };
      const m = (u + l) / 2;
      plots[3][i] = { time, value: m };
      for (let k = 0; k < LEVELS; k++) {
        // mid0..mid11: upperBand - (upperBand - midCenter) * k / 12
        // mid12..mid23: midCenter + (lowerBand - midCenter) * (k - 11) / 12
        const value = k < 12 ? u - ((u - m) * k) / 12 : m + ((l - m) * (k - 11)) / 12;
        plots[4 + k][i] = { time, value };
      }

      // aboveUpper = close[1] > upperBand[1]; returnToUpper = ... and close < upperBand and close < open
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const aboveUpper = i > 0 && gt(prevClose, s.upperBand[i - 1]);
      const returnToUpper = cfg.showReturnSignals && aboveUpper && lt(b.close, u) && lt(b.close, b.open);
      const belowLower = i > 0 && lt(prevClose, s.lowerBand[i - 1]);
      const returnToLower = cfg.showReturnSignals && belowLower && gt(b.close, l) && gt(b.close, b.open);
      const smaCrossUp = cfg.showSmaSignals && !!crossUp;
      const smaCrossDown = cfg.showSmaSignals && !!crossDown;
      if (returnToUpper) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.bearishSignalColor, size: 'tiny' });
      }
      if (returnToLower) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.bullishSignalColor, size: 'tiny' });
      }
      if (smaCrossUp) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: cfg.smaCrossUpColor, size: 'tiny' });
      }
      if (smaCrossDown) {
        s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: cfg.smaCrossDownColor, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });

      // Fills: plotUpper / mid0, mid0 / mid1, ..., mid10 / mid11 (colUpper, transparency 60..93), mid11 / mid12 (gray 95),
      // mid12 / mid13, ..., mid22 / mid23 (colLower, transparency 90..60); then plotUpper / plotLower (solid)
      const gradient = cfg.fillType === 'Gradient';
      const constant = (c: string) => new Array<string>(n).fill(c);
      const fills: NonNullable<IndicatorResult['fills']> = [];
      const level = (k: number) => `plot${4 + k}`;
      const gradFill = (plot1: string, plot2: string, c: string, tr: number) => {
        fills.push({ plot1, plot2, options: { title: 'Plots Background' },
          colors: constant(gradient ? String(color.new(c, tr)) : 'transparent') });
      };
      gradFill('plot1', level(0), cfg.colUpper, 60);
      for (let k = 0; k < 11; k++) gradFill(level(k), level(k + 1), cfg.colUpper, 63 + 3 * k);
      gradFill(level(11), level(12), color.gray, 95);
      for (let k = 12; k < 23; k++) gradFill(level(k), level(k + 1), cfg.colLower, 90 - 3 * (k - 12));
      fills.push({ plot1: 'plot1', plot2: 'plot2', options: { title: 'Solid Fill' },
        colors: constant(cfg.fillType === 'Solid' ? String(color.new(cfg.solidFillColor, 90)) : 'transparent') });

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandleChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CandleChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
