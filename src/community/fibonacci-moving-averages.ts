/**
 * Fibonacci Moving Averages
 *
 * Seven moving averages of the source with the Fibonacci lengths 5, 8, 13, 21, 34, 55 and 89. The type (SMA, EMA,
 * VWMA, WMA, HMA or RMA) is the same for all. A hidden average keeps its line, drawn fully transparent.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "Price has crossed <n> Period MA" on the
 * bars where the close crosses the 21 / 34 / 55 / 89 period average (either way), for each average whose alert
 * input is on (all off by default).
 *
 * Reference: "Fibonacci Moving Averages [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ukutaindicators
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export type FibonacciMaType = 'SMA' | 'EMA' | 'VWMA' | 'WMA' | 'HMA' | 'RMA';

export interface FibonacciMovingAveragesInputs {
  /** MA source */
  maSource: SourceType;
  /** MA type */
  maType: FibonacciMaType;
  enable5: boolean;
  color5: string;
  lineWidth5: number;
  enable8: boolean;
  color8: string;
  lineWidth8: number;
  enable13: boolean;
  color13: string;
  lineWidth13: number;
  enable21: boolean;
  color21: string;
  lineWidth21: number;
  enable34: boolean;
  color34: string;
  lineWidth34: number;
  enable55: boolean;
  color55: string;
  lineWidth55: number;
  enable89: boolean;
  color89: string;
  lineWidth89: number;
  /** Alerts Configuration: alert() when the price crosses the 21 / 34 / 55 / 89 period MA */
  alert21: boolean;
  alert34: boolean;
  alert55: boolean;
  alert89: boolean;
}

const LENGTHS = [5, 8, 13, 21, 34, 55, 89] as const;
/** The averages with an alert input */
const ALERT_LENGTHS = [21, 34, 55, 89] as const;
const COLORS: Record<number, string> = {
  5: color.orange,
  8: color.blue,
  13: color.green,
  21: 'rgb(255, 0, 255)',
  34: color.purple,
  55: color.red,
  89: color.yellow,
};

export const defaultInputs: FibonacciMovingAveragesInputs = {
  maSource: 'close',
  maType: 'EMA',
  enable5: true,
  color5: COLORS[5],
  lineWidth5: 1,
  enable8: true,
  color8: COLORS[8],
  lineWidth8: 1,
  enable13: true,
  color13: COLORS[13],
  lineWidth13: 1,
  enable21: true,
  color21: COLORS[21],
  lineWidth21: 1,
  enable34: true,
  color34: COLORS[34],
  lineWidth34: 1,
  enable55: true,
  color55: COLORS[55],
  lineWidth55: 1,
  enable89: true,
  color89: COLORS[89],
  lineWidth89: 1,
  alert21: false,
  alert34: false,
  alert55: false,
  alert89: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maSource', type: 'source', title: 'MA Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'VWMA', 'WMA', 'HMA', 'RMA'] },
  ...LENGTHS.flatMap((len): InputConfig[] => [
    { id: `enable${len}`, type: 'bool', title: `Show ${len} Period MA`, defval: true },
    { id: `color${len}`, type: 'color', title: `${len} Period MA Color`, defval: COLORS[len] },
    { id: `lineWidth${len}`, type: 'int', title: 'Line Width', defval: 1 },
  ]),
  ...ALERT_LENGTHS.map((len): InputConfig => (
    { id: `alert${len}`, type: 'bool', title: `Price Crossed MA ${len}`, defval: false, group: 'Alerts Configuration' }
  )),
];

export const plotConfig: PlotConfig[] = LENGTHS.map((len, k) => ({
  id: `plot${k}`, title: `${len} Period MA`, color: COLORS[len], lineWidth: 1,
}));

export const metadata = {
  title: 'Fibonacci Moving Averages [UkutaLabs]',
  shortTitle: 'Fibonacci Moving Averages [UkutaLabs]',
  overlay: true,
};

type Ma = { step(v: number, volume: number): number; commit(): void };
type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alertCalls: AlertCall[] };

interface FibRun extends BarRunState<Record<string, never>> {
  mas: Ma[];
  plots: Point[][];
  /** The 21 / 34 / 55 / 89 averages and the closes (the crosses read the bar before) */
  maOf: number[][];
  close: number[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<FibonacciMovingAveragesInputs>): BarStudy<FibRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.maSource);

  // MA(maSource, maType, maPeriod): the type is a constant input, one branch runs on every bar
  const ma = (len: number): Ma => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      default: { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };

  const hidden = String(color.new('#ffffff', 100));
  const colors = LENGTHS.map((len) => ((cfg as unknown as Record<string, boolean>)[`enable${len}`]
    ? (cfg as unknown as Record<string, string>)[`color${len}`] : hidden));
  const alertOn = ALERT_LENGTHS.map((len) => (cfg as unknown as Record<string, boolean>)[`alert${len}`]);
  const alertIndex = ALERT_LENGTHS.map((len) => LENGTHS.indexOf(len));
  return {
    fullRunReason: () => (isBarSource(cfg.maSource) ? null : 'source of another study'),
    init() {
      const mas = LENGTHS.map((len) => ma(len));
      const s: FibRun = {
        mas, plots: LENGTHS.map(() => []), maOf: ALERT_LENGTHS.map(() => []), close: [], alertCalls: [],
        steps: mas, vars: {}, lists: [], series: [],
      };
      s.lists = [s.alertCalls];
      s.series = [...s.plots, ...s.maOf, s.close];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const vol = b.volume ?? NaN;
      for (let k = 0; k < LENGTHS.length; k++) {
        const m = s.mas[k].step(v, vol);
        s.plots[k][i] = { time: b.time, value: m, color: colors[k] };
      }
      const c = b.close;
      s.close[i] = c;
      // if AlertNNMAPrice and (xNNUp or xNNDown): alert("Price has crossed NN Period MA", alert.freq_once_per_bar_close),
      // in the order 21, 34, 55, 89 on each bar; xNNUp / xNNDown = ta.crossover / ta.crossunder(close, MA(..., NN))
      const pc = i > 0 ? s.close[i - 1] : NaN;
      for (let k = 0; k < ALERT_LENGTHS.length; k++) {
        const m = s.plots[alertIndex[k]][i].value;
        s.maOf[k][i] = m;
        const pm = i > 0 ? s.maOf[k][i - 1] : NaN;
        const cross = (c > m && pc <= pm) || (c < m && pc >= pm);
        if (alertOn[k] && cross) {
          s.alertCalls.push({ time: b.time as number, message: `Price has crossed ${ALERT_LENGTHS[k]} Period MA`, freq: 'once_per_bar_close' });
        }
      }
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      LENGTHS.forEach((_len, k) => { plots[`plot${k}`] = s.plots[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciMovingAveragesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciMovingAveragesInputs> = {},
): IndicatorResult & { alertCalls: AlertCall[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const FibonacciMovingAverages = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
