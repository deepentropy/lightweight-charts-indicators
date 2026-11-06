/**
 * Dynamic Trend Channel (DTC)
 *
 * The trend line is the EMA of the close over `length` bars. The channel bands are the EMA +- ATR(atrLength) *
 * atrMult, with a blue fill between them. The trend line and the bars are lime when the close is above the EMA,
 * red otherwise. A BUY label marks a close crossing over the upper band, a SELL label a close crossing under the
 * lower band.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' / 'Sell Alert', true on the BUY / SELL bars.
 *
 * Reference: "Dynamic Trend Channel (DTC)" by JohnsonForexTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JohnsonForexTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicTrendChannelInputs {
  /** EMA length of the trend line */
  length: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier of the band width */
  atrMult: number;
}

export const defaultInputs: DynamicTrendChannelInputs = {
  length: 30,
  atrLength: 14,
  atrMult: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Channel Length', defval: 30, min: 10 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.5, step: 0.1 },
];

const UPPER_COLOR = String(color.new(color.green, 40));
const LOWER_COLOR = String(color.new(color.red, 40));
const FILL_COLOR = String(color.new(color.blue, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: color.lime, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: UPPER_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: LOWER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Trend Channel (DTC)',
  shortTitle: 'DTC',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface DtcRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  buy: ReturnType<typeof taStep.crossover>;
  sell: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DynamicTrendChannelInputs>): BarStudy<DtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.length);
      const atr = taStep.atr(cfg.atrLength);
      // ta.crossover(close, upperBand) / ta.crossunder(close, lowerBand): exact comparisons
      const buy = taStep.crossover();
      const sell = taStep.crossunder();
      const s: DtcRun = {
        ema, atr, buy, sell, plots: [[], [], []], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [ema, atr, buy, sell], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, ...s.flags];
      s.lists = [s.markers, s.barColors, ...s.times];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const basis = s.ema.step(close);
      const atrValue = s.atr.step(b.high, b.low, b.close);
      const upperBand = basis + atrValue * cfg.atrMult;
      const lowerBand = basis - atrValue * cfg.atrMult;
      const buySignal = s.buy.step(close, upperBand);
      const sellSignal = s.sell.step(close, lowerBand);

      const trendUp = gt(close, basis);
      const trendColor = trendUp ? color.lime : color.red;
      s.plots[0][i] = { time, value: basis, color: trendColor };
      s.plots[1][i] = { time, value: upperBand, color: UPPER_COLOR };
      s.plots[2][i] = { time, value: lowerBand, color: LOWER_COLOR };
      if (buySignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: color.black, size: 'small' });
      }
      if (sellSignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      s.barColors.push({ time, color: trendColor });
      // alertcondition(buySignal, "Buy Alert") / alertcondition(sellSignal, "Sell Alert")
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(time as number);
      if (sellSignal) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: FILL_COLOR } }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicTrendChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicTrendChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'Dynamic Trend Channel Buy' },
  { id: 'alert1', title: 'Sell Alert', message: 'Dynamic Trend Channel Sell' },
];

export const DynamicTrendChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
