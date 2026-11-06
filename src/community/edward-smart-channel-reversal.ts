/**
 * Edward Smart Channel Reversal
 *
 * A Donchian channel (highest high / lowest low over `channelLength` bars, with its middle), filled in light blue,
 * and an EMA trend line. BUY: the low touches the lower channel, the bar is green, the close is back above the lower
 * channel, the RSI is below 40 and the close is above the EMA. SELL: the high touches the upper channel, the bar is
 * red, the close is back below the upper channel, the RSI is above 60 and the close is below the EMA.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' / 'Sell Alert', true on the BUY / SELL bars.
 *
 * Reference: "Edward Smart Channel Reversal" by Jos-ProTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Jos-ProTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EdwardSmartChannelReversalInputs {
  /** Channel length (highest high / lowest low) */
  channelLength: number;
  /** Trend EMA length */
  emaLength: number;
  /** RSI length */
  rsiLength: number;
}

export const defaultInputs: EdwardSmartChannelReversalInputs = {
  channelLength: 20,
  emaLength: 100,
  rsiLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 20, min: 5 },
  { id: 'emaLength', type: 'int', title: 'Trend EMA', defval: 100 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Channel', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Lower Channel', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'Middle Channel', color: color.orange, lineWidth: 1 },
  { id: 'plot3', title: 'EMA', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Edward Smart Channel Reversal',
  shortTitle: 'Edward Smart Channel Reversal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine plotshape default text colour */
const PINE_TEXT = '#2962FF';

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface EdwardRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  ema: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EdwardSmartChannelReversalInputs>): BarStudy<EdwardRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  // fill(upperPlot, lowerPlot, color = color.new(color.blue, 92))
  const fillColor = String(color.new(color.blue, 92));

  return {
    init() {
      const upper = new WindowExtreme(false, cfg.channelLength);
      const lower = new WindowExtreme(true, cfg.channelLength);
      const ema = taStep.ema(cfg.emaLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: EdwardRun = {
        upper, lower, ema, rsi, plots: [[], [], [], []], markers: [], flags: [[], []], times: [[], []],
        steps: [upper, lower, ema, rsi], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const upper = s.upper.step(b.high);
      const lower = s.lower.step(b.low);
      const ema = s.ema.step(b.close);
      const rsi = s.rsi.step(b.close);
      const mid = (upper + lower) / 2;
      s.plots[0][i] = { time: t, value: fin(upper), color: color.red };
      s.plots[1][i] = { time: t, value: fin(lower), color: color.green };
      s.plots[2][i] = { time: t, value: fin(mid), color: color.orange };
      s.plots[3][i] = { time: t, value: fin(ema), color: color.yellow };

      const bullReversal = le(b.low, lower) && gt(b.close, b.open) && gt(b.close, lower) && lt(rsi, 40);
      const bearReversal = ge(b.high, upper) && lt(b.close, b.open) && lt(b.close, upper) && gt(rsi, 60);
      const buySignal = bullReversal && gt(b.close, ema);
      const sellSignal = bearReversal && lt(b.close, ema);
      // plotshape(buySignal, 'BUY', shape.labelup, location.belowbar, color.lime, text = 'BUY')
      if (buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY', textColor: PINE_TEXT, size: 'auto' });
      }
      // plotshape(sellSignal, 'SELL', shape.labeldown, location.abovebar, color.red, text = 'SELL')
      if (sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: PINE_TEXT, size: 'auto' });
      }
      [buySignal, sellSignal].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: new Array<string>(n).fill(fillColor) }],
        markers: s.markers.slice(),
        // alertcondition(buySignal, "Buy Alert") / alertcondition(sellSignal, "Sell Alert")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EdwardSmartChannelReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EdwardSmartChannelReversalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Edward Smart Channel Reversal BUY' },
  { id: 'alert1', title: 'Sell Alert', message: 'Edward Smart Channel Reversal SELL' },
];

export const EdwardSmartChannelReversal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
