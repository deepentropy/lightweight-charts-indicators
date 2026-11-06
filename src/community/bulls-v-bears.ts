/**
 * Bulls v Bears
 *
 * Bull pressure (high - MA) and bear pressure (MA - low) around an EMA / SMA / WMA of the close. "Normalized": each
 * pressure is scaled to -50..50 over its range of the last bars and the histogram is their difference (-100..100),
 * with fixed thresholds at +/- line height. "Raw": the histogram is bulls - bears, with thresholds at a percentile
 * of its rolling range. Dots mark the bars above the upper / below the lower threshold.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Crossover' (above the upper threshold), 'Bearish
 * Crossover' (below the lower threshold), 'Total Crossover' and 'Bearish Zero Cross' (histogram crosses above / below 0).
 *
 * Reference: "Bulls v Bears" by Mihkel00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Crossover', message: 'Bullish overbought' },
  { id: 'alert1', title: 'Bearish Crossover', message: 'Bearish oversold' },
  { id: 'alert2', title: 'Total Crossover', message: 'BvB total crossover' },
  { id: 'alert3', title: 'Bearish Zero Cross', message: 'Bulls v Bears: Bearish zero line cross' },
];

export interface BullsVBearsInputs {
  /** BvB period (MA length) */
  len: number;
  maType: 'EMA' | 'SMA' | 'WMA';
  normType: 'Normalized' | 'Raw';
  /** Range length of the Normalized method */
  barsBack: number;
  /** Rolling period of the Raw thresholds */
  rawLookback: number;
  /** Percentile of the Raw thresholds */
  rawPercentile: number;
  /** Threshold of the Normalized method */
  tline: number;
  showThresholdLines: boolean;
  bullColor: string;
  bearColor: string;
  showSignals: boolean;
  bullishDotColor: string;
  bearishDotColor: string;
}

export const defaultInputs: BullsVBearsInputs = {
  len: 14,
  maType: 'EMA',
  normType: 'Normalized',
  barsBack: 120,
  rawLookback: 50,
  rawPercentile: 95,
  tline: 80,
  showThresholdLines: true,
  bullColor: String(color.new(color.green, 20)),
  bearColor: String(color.new(color.red, 20)),
  showSignals: true,
  bullishDotColor: '#ff00d4',
  bearishDotColor: '#eeff00',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'BvB Period', defval: 14, min: 1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA'] },
  { id: 'normType', type: 'string', title: 'Calculation Method', defval: 'Normalized', options: ['Normalized', 'Raw'] },
  { id: 'barsBack', type: 'int', title: 'Normalized Bars Back', defval: 120, min: 1 },
  { id: 'rawLookback', type: 'int', title: 'Raw Rolling Period', defval: 50, min: 10 },
  { id: 'rawPercentile', type: 'float', title: 'Raw Threshold Percentile', defval: 95, min: 80, max: 99 },
  { id: 'tline', type: 'float', title: 'Line Height', defval: 80, min: 0, max: 100 },
  { id: 'showThresholdLines', type: 'bool', title: 'Show Threshold Lines', defval: true },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: String(color.new(color.green, 20)) },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: String(color.new(color.red, 20)) },
  { id: 'showSignals', type: 'bool', title: 'Show Signal Dots', defval: true },
  { id: 'bullishDotColor', type: 'color', title: 'Bullish Signal Color', defval: '#ff00d4' },
  { id: 'bearishDotColor', type: 'color', title: 'Bearish Signal Color', defval: '#eeff00' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BvB', color: String(color.new(color.green, 20)), lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Upper Threshold (Raw)', color: String(color.new(color.gray, 50)), lineWidth: 1 },
  { id: 'plot2', title: 'Lower Threshold (Raw)', color: String(color.new(color.gray, 50)), lineWidth: 1 },
];

export const metadata = {
  title: 'Bulls v Bears v6',
  shortTitle: 'BvB v6',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine division: x / 0 is na */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface BvbRun extends BarRunState<Record<string, never>> {
  ma: { step(v: number): number; commit(): void };
  minBulls: WindowExtreme;
  maxBulls: WindowExtreme;
  minBears: WindowExtreme;
  maxBears: WindowExtreme;
  rawHighest: WindowExtreme;
  rawLowest: WindowExtreme;
  total: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BullsVBearsInputs>): BarStudy<BvbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const normalized = cfg.normType === 'Normalized';
  const raw = cfg.normType === 'Raw' && cfg.showThresholdLines;
  const thresholdColor = String(color.new(color.gray, 50));
  return {
    init() {
      // ma = switch ma_type: "EMA" => ta.ema, "SMA" => ta.sma, "WMA" => ta.wma, => ta.ema
      let ma: BvbRun['ma'];
      if (cfg.maType === 'SMA') ma = new WindowSma(cfg.len);
      else if (cfg.maType === 'WMA') { const m = taStep.wma(); ma = { step: (v) => m.step(v, cfg.len), commit: () => m.commit() }; }
      else ma = taStep.ema(cfg.len);
      const s: BvbRun = {
        ma, minBulls: new WindowExtreme(true, cfg.barsBack), maxBulls: new WindowExtreme(false, cfg.barsBack),
        minBears: new WindowExtreme(true, cfg.barsBack), maxBears: new WindowExtreme(false, cfg.barsBack),
        rawHighest: new WindowExtreme(false, cfg.rawLookback), rawLowest: new WindowExtreme(true, cfg.rawLookback),
        total: [], plots: [[], [], []], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma, s.minBulls, s.maxBulls, s.minBears, s.maxBears, s.rawHighest, s.rawLowest];
      s.lists = [...s.times, s.markers];
      s.series = [s.total, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const ma = s.ma.step(b.close);
      const bulls = b.high - ma;
      const bears = ma - b.low;

      let total: number;
      if (normalized) {
        const minBulls = s.minBulls.step(bulls);
        const maxBulls = s.maxBulls.step(bulls);
        const minBears = s.minBears.step(bears);
        const maxBears = s.maxBears.step(bears);
        const normBulls = (div(bulls - minBulls, maxBulls - minBulls) - 0.5) * 100;
        const normBears = (div(bears - minBears, maxBears - minBears) - 0.5) * 100;
        total = normBulls - normBears;
      } else {
        total = bulls - bears;
      }
      s.total[i] = total;

      // Raw percentile thresholds
      const rawHighest = s.rawHighest.step(total);
      const rawLowest = s.rawLowest.step(total);
      const rawRange = rawHighest - rawLowest;
      const rawUpper = rawLowest + rawRange * (cfg.rawPercentile / 100);
      const rawLower = rawLowest + rawRange * ((100 - cfg.rawPercentile) / 100);
      const upper = normalized ? cfg.tline : rawUpper;
      const lower = normalized ? -cfg.tline : rawLower;

      // bullish_o = total > upper_threshold; bearish_o = total < lower_threshold
      const bullishO = gt(total, upper);
      const bearishO = lt(total, lower);
      // plotshape(show_signals and bullish_o, shape.circle, location.top, ...); bearish_o: location.bottom.
      if (cfg.showSignals && bullishO) {
        s.markers.push({ time, position: 'top', shape: 'circle', color: cfg.bullishDotColor, size: 'auto' });
      }
      if (cfg.showSignals && bearishO) {
        s.markers.push({ time, position: 'bottom', shape: 'circle', color: cfg.bearishDotColor, size: 'auto' });
      }

      const p = s.plots;
      // plot(total, color = total >= 0 ? bull_color : bear_color, style = plot.style_columns, title = "BvB")
      p[0][i] = { time, value: total, color: ge(total, 0) ? cfg.bullColor : cfg.bearColor };
      // plot(norm_type == "Raw" and show_threshold_lines ? upper_threshold / lower_threshold : na)
      p[1][i] = { time, value: raw ? upper : NaN, color: thresholdColor };
      p[2][i] = { time, value: raw ? lower : NaN, color: thresholdColor };

      // alertcondition(bullish_o) / (bearish_o) / (ta.crossover(total, 0)) / (ta.crossunder(total, 0))
      const prev = i > 0 ? s.total[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = bullishO;
      f[1][i] = bearishO;
      f[2][i] = total > 0 && prev <= 0;
      f[3][i] = total < 0 && prev >= 0;
      for (let k = 0; k < 4; k++) if (f[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      // hline(norm_type == "Normalized" and show_threshold_lines ? tline / -tline : na): an na hline is not drawn
      const hlineOptions = { color: thresholdColor, linestyle: 'dotted' as const };
      const hlines = normalized && cfg.showThresholdLines
        ? [
          { value: cfg.tline, options: { title: 'Upper Threshold', ...hlineOptions } },
          { value: -cfg.tline, options: { title: 'Lower Threshold', ...hlineOptions } },
        ]
        : [];
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice() },
        hlines,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BullsVBearsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BullsVBearsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BullsVBears = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
