/**
 * Theil-Sen Line Filter
 *
 * On each bar, the slopes (src - src[i]) / i for i = 1..window (bars with an na source skipped) are sorted and
 * their median is the Theil-Sen slope (0 when there is no slope). An optional cap limits the slope to +-cap (ATR *
 * multiplier, a percent of the price or fixed points). The filtered line starts at the source and moves by
 * response * slope per bar. The trend is up when the line rises and down when it falls (kept when flat); the line
 * and the candles take the long / short colour of the trend (white before the first move).
 * Alerts (alertcondition, `alerts` of the result): 'Theil-Sen Up Slope' / 'Theil-Sen Down Slope' when the change of
 * the line (tsf - tsf[1]) crosses over / under 0.
 *
 * Reference: "Theil-Sen Line Filter [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { taStep, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TheilSenLineFilterInputs {
  /** Series to filter with the Theil-Sen median-slope line */
  pricesource: SourceType;
  /** Number of past bars used for the slope estimates */
  winLen: number;
  /** Multiplier on the median slope per bar */
  response: number;
  /** Optional per-bar slope cap */
  capMode: 'None' | 'ATR' | 'Percent' | 'Points';
  /** ATR period when the cap mode is ATR */
  atrLen: number;
  /** Slope cap = ATR * ATR Mult when the cap mode is ATR */
  capMult: number;
  /** Slope cap = price * Cap Percent % when the cap mode is Percent */
  capPct: number;
  /** Slope cap in price points when the cap mode is Points */
  capPts: number;
  showLine: boolean;
  paintCandles: boolean;
  longColor: string;
  shortColor: string;
}

export const defaultInputs: TheilSenLineFilterInputs = {
  pricesource: 'close',
  winLen: 70,
  response: 0.97,
  capMode: 'None',
  atrLen: 14,
  capMult: 0.5,
  capPct: 0.2,
  capPts: 5.0,
  showLine: true,
  paintCandles: true,
  longColor: '#00ff00',
  shortColor: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'pricesource', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'winLen', type: 'int', title: 'Window Length', defval: 70, min: 2, max: 300 },
  { id: 'response', type: 'float', title: 'Response', defval: 0.97, min: 0.01, max: 2.0, step: 0.01 },
  { id: 'capMode', type: 'string', title: 'Slope Cap Mode', defval: 'None', options: ['None', 'ATR', 'Percent', 'Points'] },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'capMult', type: 'float', title: 'ATR Mult', defval: 0.5, step: 0.05 },
  { id: 'capPct', type: 'float', title: 'Cap Percent', defval: 0.2, step: 0.05 },
  { id: 'capPts', type: 'float', title: 'Cap Points', defval: 5.0, step: 0.1 },
  { id: 'showLine', type: 'bool', title: 'Show Filtered Line', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles according to slope', defval: true },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#00ff00' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff0000' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Theil-Sen', color: String(color.new(color.white, 40)), lineWidth: 4 },
];

export const metadata = {
  title: 'Theil-Sen Line Filter [BackQuant]',
  shortTitle: 'Theil-Sen [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface TheilSenVars {
  /** var int Trend = 0 */
  trend: number;
  /** var color barColour = color.white */
  barColour: string;
}

interface TheilSenRun extends BarRunState<TheilSenVars> {
  atr: ReturnType<typeof taStep.atr> | null;
  /** The source of another study (read from the whole bar set; such a run is always full) */
  external: number[] | null;
  src: number[];
  tsf: number[];
  change: number[];
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  flags: boolean[][];
}

function study(inputs: Partial<TheilSenLineFilterInputs>): BarStudy<TheilSenRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.pricesource);
  const a: number[] = [];
  return {
    fullRunReason: () => (isBarSource(cfg.pricesource) ? null : 'source of another study'),
    init(bars) {
      const s: TheilSenRun = {
        atr: cfg.capMode === 'ATR' ? taStep.atr(cfg.atrLen) : null,
        external: isBarSource(cfg.pricesource) ? null : getSourceSeries(bars, cfg.pricesource).toArray().map((v) => v ?? NaN),
        src: [], tsf: [], change: [], plot0: [], barColors: [], flags: [[], []],
        steps: [], vars: { trend: 0, barColour: color.white }, lists: [], series: [],
      };
      if (s.atr) s.steps = [s.atr];
      s.lists = [s.barColors];
      s.series = [s.src, s.tsf, s.change, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = s.src;
      src[i] = s.external ? s.external[i] : value(b);
      const atr = s.atr ? s.atr.step(b.high, b.low, b.close) : NaN;
      // ts_median_slope(src, len): slopes (src - src[k]) / k for k = 1..len, na values skipped
      a.length = 0;
      for (let k = 1; k <= cfg.winLen; k++) {
        const p = i - k >= 0 ? src[i - k] : NaN;
        if (!isNaN(p)) a.push((src[i] - p) / k);
      }
      const m = a.length;
      let slope: number;
      if (m === 0) {
        slope = 0.0;
      } else {
        a.sort((x, y) => x - y);
        // mid = n / 2: a fractional quotient (n odd) is truncated by array.get
        const mid = Math.trunc(m / 2);
        slope = m % 2 === 1 ? a[mid] : (a[mid - 1] + a[mid]) * 0.5;
      }

      // Optional slope cap
      const baseCap = cfg.capMode === 'ATR' ? atr * cfg.capMult
        : cfg.capMode === 'Percent' ? Math.abs(src[i]) * cfg.capPct * 0.01
          : cfg.capMode === 'Points' ? cfg.capPts : NaN;
      const slopeCap = baseCap;
      if (!isNaN(slopeCap)) slope = gt(slope, slopeCap) ? slopeCap : lt(slope, -slopeCap) ? -slopeCap : slope;

      // tsf := na(tsf[1]) ? pricesource : tsf[1] + response * slope
      const tsf = s.tsf;
      const prev = i > 0 ? tsf[i - 1] : NaN;
      tsf[i] = isNaN(prev) ? src[i] : prev + cfg.response * slope;

      v.trend = gt(tsf[i], prev) ? 1 : lt(tsf[i], prev) ? -1 : v.trend;
      v.barColour = v.trend === 1 ? cfg.longColor : v.trend === -1 ? cfg.shortColor : v.barColour;

      // barcolor(paintCandles ? barColour : na)
      if (cfg.paintCandles) s.barColors.push({ time: b.time as number, color: v.barColour });
      // plot(showLine ? tsf : na, "Theil-Sen", color.new(barColour, 40), linewidth = 4)
      s.plot0[i] = { time: b.time as number, value: cfg.showLine ? tsf[i] : NaN, color: String(color.new(v.barColour, 40)) };

      // upTurn = ta.crossover(tsf - tsf[1], 0), dnTurn = ta.crossunder(tsf - tsf[1], 0)
      const change = i > 0 ? tsf[i] - tsf[i - 1] : NaN;
      s.change[i] = change;
      const pc = i > 0 ? s.change[i - 1] : NaN;
      s.flags[0][i] = change > 0 && pc <= 0;
      s.flags[1][i] = change < 0 && pc >= 0;
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: [],
        barColors: s.barColors.slice(),
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TheilSenLineFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TheilSenLineFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Theil-Sen Up Slope', message: 'Theil-Sen slope turned up {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Theil-Sen Down Slope', message: 'Theil-Sen slope turned down {{exchange}}:{{ticker}}' },
];

export const TheilSenLineFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
