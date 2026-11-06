/**
 * S&R Breakout ATR Confirmation
 *
 * Resistance and support are the highest high and the lowest low of the previous `lookback` bars. A bullish breakout
 * is a close above the resistance with a candle body (close - open) larger than ATR * multiplier and, with the volume
 * filter, a volume above its SMA; a bearish breakout is the mirror below the support. Breakouts get a BUY / SELL
 * label and a green / red background.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Breakout' and 'Bearish Breakout', true on the breakouts.
 *
 * Reference: "S&R Breakout ATR Confirmation" by Jos-ProTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Jos-ProTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SRBreakoutAtrConfirmationInputs {
  /** Support / resistance length */
  lookback: number;
  /** ATR length */
  atrLength: number;
  /** ATR strength multiplier */
  atrMultiplier: number;
  /** Require a volume above its SMA */
  useVolume: boolean;
  /** SMA length of the volume */
  volumeLength: number;
}

export const defaultInputs: SRBreakoutAtrConfirmationInputs = {
  lookback: 20,
  atrLength: 14,
  atrMultiplier: 1.0,
  useVolume: true,
  volumeLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Support/Resistance Length', defval: 20, min: 5 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Strength Multiplier', defval: 1.0, step: 0.1 },
  { id: 'useVolume', type: 'bool', title: 'Use Volume Filter', defval: true },
  { id: 'volumeLength', type: 'int', title: 'Volume MA Length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'S&R Breakout ATR Confirmation',
  shortTitle: 'S&R Breakout ATR Confirmation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface BreakoutRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  volMA: WindowSma;
  hhs: number[];
  lls: number[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SRBreakoutAtrConfirmationInputs>): BarStudy<BreakoutRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBg = String(color.new(color.green, 90));
  const bearBg = String(color.new(color.red, 90));
  return {
    init() {
      const hh = new WindowExtreme(false, cfg.lookback);
      const ll = new WindowExtreme(true, cfg.lookback);
      const atr = taStep.atr(cfg.atrLength);
      const volMA = new WindowSma(cfg.volumeLength);
      const s: BreakoutRun = {
        hh, ll, atr, volMA, hhs: [], lls: [], plots: [[], []], markers: [], bgColors: [], flags: [[], []],
        times: [[], []], steps: [hh, ll, atr, volMA], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.hhs, s.lls, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { open, close, high, low, time } = bars[i];
      s.hhs[i] = s.hh.step(high);
      s.lls[i] = s.ll.step(low);
      // resistance = ta.highest(high, lookback)[1]; support = ta.lowest(low, lookback)[1]
      const resistance = i > 0 ? s.hhs[i - 1] : NaN;
      const support = i > 0 ? s.lls[i - 1] : NaN;
      const atr = s.atr.step(high, low, close);
      const vol = bars[i].volume;
      const volume = vol === undefined || vol === null ? NaN : vol;
      const volMA = s.volMA.step(volume);
      s.plots[0][i] = { time, value: resistance, color: color.red };
      s.plots[1][i] = { time, value: support, color: color.green };

      const bullStrength = gt(close - open, atr * cfg.atrMultiplier);
      const bearStrength = gt(open - close, atr * cfg.atrMultiplier);
      const volumeConfirm = gt(volume, volMA);
      const bullBreakout = gt(close, resistance) && bullStrength && (!cfg.useVolume || volumeConfirm);
      const bearBreakout = lt(close, support) && bearStrength && (!cfg.useVolume || volumeConfirm);
      s.flags[0][i] = bullBreakout;
      s.flags[1][i] = bearBreakout;
      if (bullBreakout) s.times[0].push(time as number);
      if (bearBreakout) s.times[1].push(time as number);
      // plotshape(..., style = shape.labelup / labeldown, text = 'BUY' / 'SELL'): Pine default size (auto) and
      // default text colour (#2962FF)
      if (bullBreakout) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: '#2962FF', size: 'auto' });
      }
      if (bearBreakout) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: '#2962FF', size: 'auto' });
      }
      // bgcolor(bullBreakout ? color.new(color.green, 90) : na); bgcolor(bearBreakout ? color.new(color.red, 90) : na)
      if (bullBreakout) s.bgColors.push({ time, color: bullBg });
      if (bearBreakout) s.bgColors.push({ time, color: bearBg });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(bullBreakout, 'Bullish Breakout') / alertcondition(bearBreakout, 'Bearish Breakout')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SRBreakoutAtrConfirmationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SRBreakoutAtrConfirmationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Breakout', message: 'Breakout Confirmation Pro BUY Signal' },
  { id: 'alert1', title: 'Bearish Breakout', message: 'Breakout Confirmation Pro SELL Signal' },
];

export const SRBreakoutAtrConfirmation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
