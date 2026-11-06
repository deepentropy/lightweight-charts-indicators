/**
 * RSI Confirm Trend with Williams (W%R)
 *
 * RSI(14) of the close with an SMA / EMA of it. The background shows the trend: green when the RSI is at or above
 * the upper threshold and Williams %R(14) is at or above -20, light cyan when only the RSI is at or above the upper
 * threshold, red when the RSI is at or below the lower threshold and Williams %R is at or below -80, pink when only
 * the RSI is at or below the lower threshold. Dotted lines at both thresholds with a fill between them.
 *
 * Reference: "RSI Confirm Trend with Williams (W%R)" by javageek
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © javageek
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData } from '../types';

export interface RsiConfirmTrendWithWilliamsInputs {
  /** RSI upper threshold */
  obr: number;
  /** RSI lower threshold */
  osr: number;
  /** Type of the RSI moving average */
  maType: 'SMA' | 'EMA';
  /** Length of the RSI moving average */
  maLength: number;
}

export const defaultInputs: RsiConfirmTrendWithWilliamsInputs = {
  obr: 55,
  osr: 45,
  maType: 'SMA',
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'obr', type: 'int', title: 'RSI Upper Threshold', defval: 55 },
  { id: 'osr', type: 'int', title: 'RSI Lower Threshold', defval: 45 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA'], display: 'data_window' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, display: 'data_window' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'RSI MA', color: color.orange, lineWidth: 1 },
];

const THRESHOLD_FILL = String(color.new('#9598a1', 70));

/** hline(obr / osr, color.gray, hline.style_dotted) with the default values (the result `hlines` carry the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 55, title: 'RSI Upper Threshold', color: color.gray, linestyle: 'dotted' },
  { id: 'hline_lower', price: 45, title: 'RSI Lower Threshold', color: color.gray, linestyle: 'dotted' },
];

/** fill(h3, h4, color.new(#9598a1, 70)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_threshold', plot1: 'hline_upper', plot2: 'hline_lower', color: THRESHOLD_FILL, title: 'RSI Threshold Background' },
];

export const metadata = {
  title: 'RSI Confirm Trend with Williams (W%R)',
  shortTitle: 'RSI W%R Trend',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface RsiwRun extends BarRunState<Record<string, never>> {
  /** ta.wpr(14): highest high and lowest low of 14 bars */
  hh: WindowExtreme;
  ll: WindowExtreme;
  rsi: ReturnType<typeof taStep.rsi>;
  ma: { step(v: number): number; commit(): void } | null;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RsiConfirmTrendWithWilliamsInputs>): BarStudy<RsiwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const green = String(color.new(color.green, 70));
  const cyan = String(color.new('#89ede5', 70));
  const red = String(color.new(color.red, 70));
  const pink = String(color.new('#f28ec3', 70));
  return {
    init() {
      const hh = new WindowExtreme(false, 14);
      const ll = new WindowExtreme(true, 14);
      const rsi = taStep.rsi(14);
      // ma(source, length, type): switch type "SMA" => ta.sma, "EMA" => ta.ema (no default: na)
      const ma = cfg.maType === 'SMA' ? new WindowSma(cfg.maLength) : cfg.maType === 'EMA' ? taStep.ema(cfg.maLength) : null;
      const s: RsiwRun = {
        hh, ll, rsi, ma, plot0: [], plot1: [], bgColors: [],
        steps: [hh, ll, rsi, ...(ma ? [ma] : [])], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ta.wpr(14) = 100 * (close - highest(high)) / (highest(high) - lowest(low)), na on a zero range
      const hmax = s.hh.step(b.high);
      const range = hmax - s.ll.step(b.low);
      const percentR = range === 0 ? NaN : (100 * (b.close - hmax)) / range;
      const rsi = s.rsi.step(b.close);
      const rsiMA = s.ma ? s.ma.step(rsi) : NaN;
      const up = ge(rsi, cfg.obr);
      const down = le(rsi, cfg.osr);
      const c = up && ge(percentR, -20) ? green : up ? cyan
        : down && le(percentR, -80) ? red : down ? pink : null;
      if (c) s.bgColors.push({ time: b.time, color: c });
      s.plot0[i] = { time: b.time, value: rsi, color: color.blue };
      s.plot1[i] = { time: b.time, value: rsiMA, color: color.orange };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.obr, options: { title: 'RSI Upper Threshold', color: color.gray, linestyle: 'dotted' } },
          { value: cfg.osr, options: { title: 'RSI Lower Threshold', color: color.gray, linestyle: 'dotted' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'RSI Threshold Background' },
            colors: new Array<string>(n).fill(THRESHOLD_FILL) },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiConfirmTrendWithWilliamsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiConfirmTrendWithWilliamsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiConfirmTrendWithWilliams = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
