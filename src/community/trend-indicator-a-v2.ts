/**
 * Trend Indicator A (v2.3), smoothed Heikin Ashi cloud
 *
 * A moving average of each price of the Heikin Ashi candles of the chart timeframe (open, close, high, low). The
 * cloud between the smoothed open and the smoothed close has the positive colour when the close line is above the
 * open line (trend = 100 * (close - open) / (high - low) > 0), else the negative colour. Two lighter clouds go from
 * the smoothed high to the top of the body and from the bottom of the body to the smoothed low.
 *
 * Heikin Ashi candle: close = (open + high + low + close) / 4; open = the average of the open and the close of the
 * candle before (the average of open and close on the first bar); high / low = the highest / lowest of the bar
 * high / low and the candle open and close.
 *
 * Moving average types: ALMA, HMA, SMA, SWMA, VWMA, WMA, ZLEMA (an EMA of x + x - x[(length - 1) / 2]) and EMA. As
 * in the original, the type "WMA" computes the volume weighted average, the same as "VWMA".
 *
 * Reference: "Trend Indicator A (v2.3)" by DZIV
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Author DZIV (dzi_v_)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { AlmaStep, WindowSma, WindowVwma, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendIndicatorAV2Inputs {
  maType: 'ALMA' | 'HMA' | 'SMA' | 'SWMA' | 'VWMA' | 'WMA' | 'ZLEMA' | 'EMA';
  maPeriod: number;
  almaOffset: number;
  almaSigma: number;
  showCloseLine: boolean;
  showHighLowLines: boolean;
  showFill: boolean;
  colorPositive: string;
  colorNegative: string;
  colorNeutral: string;
}

export const defaultInputs: TrendIndicatorAV2Inputs = {
  maType: 'EMA',
  maPeriod: 9,
  almaOffset: 0.85,
  almaSigma: 6,
  showCloseLine: true,
  showHighLowLines: false,
  showFill: true,
  colorPositive: '#26A69A',
  colorNegative: '#EF5350',
  colorNeutral: '#808080',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA',
    options: ['ALMA', 'HMA', 'SMA', 'SWMA', 'VWMA', 'WMA', 'ZLEMA', 'EMA'], group: 'Setup',
  },
  { id: 'maPeriod', type: 'int', title: 'MA Period (Length)', defval: 9, min: 1, group: 'Setup' },
  { id: 'almaOffset', type: 'float', title: 'ALMA Shift', defval: 0.85, min: 0, max: 1, step: 0.05, group: 'Setup (ALMA)' },
  { id: 'almaSigma', type: 'int', title: 'ALMA Deviation', defval: 6, min: 1, step: 1, group: 'Setup (ALMA)' },
  { id: 'showCloseLine', type: 'bool', title: 'Show Close line', defval: true, group: 'On/Off' },
  { id: 'showHighLowLines', type: 'bool', title: 'Show High/Low lines', defval: false, group: 'On/Off' },
  { id: 'showFill', type: 'bool', title: 'Show fill', defval: true, group: 'On/Off' },
  { id: 'colorPositive', type: 'color', title: 'Positive color (Bullish)', defval: '#26A69A', group: 'Colors' },
  { id: 'colorNegative', type: 'color', title: 'Negative color (Bearish)', defval: '#EF5350', group: 'Colors' },
  { id: 'colorNeutral', type: 'color', title: 'Neutral color', defval: '#808080', group: 'Colors' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Open line', color: 'transparent' },
  { id: 'plot1', title: 'Close line', color: '#26A69A', lineWidth: 2 },
  { id: 'plot2', title: 'High line', color: '#808080' },
  { id: 'plot3', title: 'Low line', color: '#808080' },
  { id: 'plot4', title: 'Highest Body line', color: 'transparent' },
  { id: 'plot5', title: 'Lowest Body line', color: 'transparent' },
];

export const metadata = {
  title: 'Trend Indicator A (v2.3)',
  shortTitle: 'Trend Indicator A (v2.3)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

/** f(x) of one price, stepped bar by bar: `step(values, i, volume)` with the values of every bar up to `i` */
interface MaStep {
  step(values: number[], i: number, volume: number): number;
  commit(): void;
}

const noCommit = (): void => {};

/** The moving average of the type of the inputs (only the one in use is created, as the original calls only it) */
function maStep(cfg: TrendIndicatorAV2Inputs, period: number): MaStep {
  switch (cfg.maType) {
    case 'ALMA': {
      const m = new AlmaStep(period, cfg.almaOffset, cfg.almaSigma);
      return { step: (x, i) => m.step(x[i]), commit: () => m.commit() };
    }
    case 'HMA': {
      const m = taStep.hma(period);
      return { step: (x, i) => m.step(x[i]), commit: () => m.commit() };
    }
    case 'SMA': {
      const m = new WindowSma(period);
      return { step: (x, i) => m.step(x[i]), commit: () => m.commit() };
    }
    // ta.swma(x): (x + 2 * x[1] + 2 * x[2] + x[3]) / 6, na on the first 3 bars
    case 'SWMA': return { step: (x, i) => (i < 3 ? NaN : (x[i] + 2 * x[i - 1] + 2 * x[i - 2] + x[i - 3]) / 6), commit: noCommit };
    case 'VWMA':
    case 'WMA': {
      const m = new WindowVwma(period);
      return { step: (x, i, volume) => m.step(x[i], volume), commit: () => m.commit() };
    }
    case 'ZLEMA': {
      const lag = Math.floor((period - 1) / 2);
      const m = taStep.ema(period);
      return {
        step: (x, i) => {
          const v = x[i];
          return m.step(v + v - (i >= lag ? x[i - lag] : NaN));
        },
        commit: () => m.commit(),
      };
    }
    default: {
      const m = taStep.ema(period);
      return { step: (x, i) => m.step(x[i]), commit: () => m.commit() };
    }
  }
}

interface TrendIndicatorRun extends BarRunState<Record<string, never>> {
  mas: MaStep[];
  /** Heikin Ashi open, close, high, low of every bar */
  ha: number[][];
  plots: Point[][];
  cloud: string[];
  upper: string[];
  lower: string[];
}

function study(inputs: Partial<TrendIndicatorAV2Inputs>): BarStudy<TrendIndicatorRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const period = Math.trunc(cfg.maPeriod);
  const neutral = cfg.showHighLowLines ? cfg.colorNeutral : 'transparent';
  const cloudNeutral = cfg.showFill ? String(color.new(cfg.colorNeutral, 87.5)) : 'transparent';
  return {
    init() {
      const mas = [maStep(cfg, period), maStep(cfg, period), maStep(cfg, period), maStep(cfg, period)];
      const s: TrendIndicatorRun = {
        mas, ha: [[], [], [], []], plots: [[], [], [], [], [], []], cloud: [], upper: [], lower: [],
        steps: mas, vars: {}, lists: [], series: [],
      };
      s.series = [...s.ha, ...s.plots, s.cloud, s.upper, s.lower];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const [haOpen, haClose, haHigh, haLow] = s.ha;
      // Heikin Ashi candles of the bars (ticker.heikinashi on the chart timeframe)
      const close = (b.open + b.high + b.low + b.close) / 4;
      const open = i === 0 ? (b.open + b.close) / 2 : (haOpen[i - 1] + haClose[i - 1]) / 2;
      haOpen[i] = open;
      haClose[i] = close;
      haHigh[i] = Math.max(b.high, open, close);
      haLow[i] = Math.min(b.low, open, close);
      const volume = b.volume ?? NaN;
      const maOpen = s.mas[0].step(haOpen, i, volume);
      const maClose = s.mas[1].step(haClose, i, volume);
      const maHigh = s.mas[2].step(haHigh, i, volume);
      const maLow = s.mas[3].step(haLow, i, volume);

      // A plain division: x / 0 is +-infinity (0 / 0 na), and the comparison uses the infinite value
      const trend = (100 * (maClose - maOpen)) / (maHigh - maLow);
      const colorTrend = gt(trend, 0) ? cfg.colorPositive : cfg.colorNegative;
      const p = s.plots;
      p[0][i] = { time, value: maOpen, color: 'transparent' };
      p[1][i] = { time, value: maClose, color: cfg.showCloseLine ? colorTrend : 'transparent' };
      p[2][i] = { time, value: maHigh, color: neutral };
      p[3][i] = { time, value: maLow, color: neutral };
      p[4][i] = { time, value: Math.max(maOpen, maClose), color: 'transparent' };
      p[5][i] = { time, value: Math.min(maOpen, maClose), color: 'transparent' };
      s.cloud[i] = String(color.new(colorTrend, 50));
      s.upper[i] = cloudNeutral;
      s.lower[i] = cloudNeutral;
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(), plot5: p[5].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Open/Close Cloud' }, colors: s.cloud.slice() },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'High Cloud' }, colors: s.upper.slice() },
          { plot1: 'plot5', plot2: 'plot3', options: { title: 'Low Cloud' }, colors: s.lower.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendIndicatorAV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendIndicatorAV2Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendIndicatorAV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
