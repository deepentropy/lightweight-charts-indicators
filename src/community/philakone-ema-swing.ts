/**
 * Philakone 55 EMA Swing Trading
 *
 * MAs 8 / 13 / 21 / 55 (EMA, or SMA with 'Exponential MA' off) for swing trading. Buy: MA 21 crosses MA 55 with
 * MA 8 > MA 13 and MA 21 > MA 55; Sell: the mirror. Each MA is drawn from its first value (bar length - 1), the
 * markers on every bar where the original's conditions are true (the cross needs both MAs on the bar before).
 * Lines red (8), orange (13), yellow (21) and lime (55), as the original.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Condition' / 'Sell Condition', true on the bars where EMA 21
 * crosses EMA 55 with EMA 8 > EMA 13 and EMA 21 > EMA 55 (buy) or the mirror (sell).
 *
 * Reference: "Philakone 55 EMA Swing Trading" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PhilakoneEMASwingInputs {
  src: SourceType;
  exponential: boolean;
}

export const defaultInputs: PhilakoneEMASwingInputs = {
  src: 'close',
  exponential: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'exponential', type: 'bool', title: 'Exponential MA', defval: true },
];

// plot(ma8 / ma13 / ma21 / ma55, color = color.new(color.red / orange / yellow / lime, 0), linewidth = 1 / 2 / 3 / 4)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '8', color: '#FF5252', lineWidth: 1 },
  { id: 'plot1', title: '13', color: '#FF9800', lineWidth: 2 },
  { id: 'plot2', title: '21', color: '#FFEB3B', lineWidth: 3 },
  { id: 'plot3', title: '55', color: '#00E676', lineWidth: 4 },
];

export const metadata = {
  title: 'Philakone 55 EMA Swing Trading',
  shortTitle: 'P55EMA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number };
type Ma = { step(v: number): number; commit(): void };

interface SwingRun extends BarRunState<{ pm21: number; pm55: number }> {
  mas: Ma[];
  lines: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<PhilakoneEMASwingInputs>): BarStudy<SwingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // maN = exponential ? ta.ema(src, N) : ta.sma(src, N)
  const ma = (len: number): Ma => (cfg.exponential ? taStep.ema(len) : new WindowSma(len));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const mas = [ma(8), ma(13), ma(21), ma(55)];
      const s: SwingRun = {
        mas, lines: [[], [], [], []], flags: [[], []], times: [[], []], markers: [],
        steps: mas, vars: { pm21: NaN, pm55: NaN }, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [...s.lines, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const x = value(b);
      const m8 = s.mas[0].step(x), m13 = s.mas[1].step(x), m21 = s.mas[2].step(x), m55 = s.mas[3].step(x);
      s.lines[0][i] = { time: b.time, value: m8 };
      s.lines[1][i] = { time: b.time, value: m13 };
      s.lines[2][i] = { time: b.time, value: m21 };
      s.lines[3][i] = { time: b.time, value: m55 };

      // buy_cond / sell_cond of the original on every bar (na compares false)
      const pm21 = s.vars.pm21, pm55 = s.vars.pm55;
      s.vars.pm21 = m21;
      s.vars.pm55 = m55;
      const cross = (m21 > m55 && pm21 <= pm55) || (m21 < m55 && pm21 >= pm55);
      const buy = cross && m8 > m13 && m21 > m55;
      const sell = cross && m8 < m13 && m21 < m55;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(b.time as number);
      if (sell) s.times[1].push(b.time as number);

      // plotshape(buy_cond, 'buy', shape.triangleup, location.belowbar, color.new(color.lime, 35), text = 'Buy') and
      // plotshape(sell_cond, 'sell', shape.triangledown, location.abovebar, color.new(color.red, 35), text = 'Sell')
      if (buy) {
        s.markers.push({ id: 'shape0', time: b.time, position: 'belowBar', shape: 'triangleUp', color: 'rgba(0,230,118,0.65)', text: 'Buy', textColor: 'rgba(0,230,118,0.65)', size: 'normal' });
      }
      if (sell) {
        s.markers.push({ id: 'shape1', time: b.time, position: 'aboveBar', shape: 'triangleDown', color: 'rgba(255,82,82,0.65)', text: 'Sell', textColor: 'rgba(255,82,82,0.65)', size: 'normal' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.lines[0].slice(), 'plot1': s.lines[1].slice(), 'plot2': s.lines[2].slice(), 'plot3': s.lines[3].slice() },
        markers: s.markers.slice(),
        // alertcondition(buy_cond, 'Buy Condition') / alertcondition(sell_cond, 'Sell Condition')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PhilakoneEMASwingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PhilakoneEMASwingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Condition', message: 'Buy Condition Alert' },
  { id: 'alert1', title: 'Sell Condition', message: 'Sell Condition Alert' },
];

export const PhilakoneEMASwing = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
