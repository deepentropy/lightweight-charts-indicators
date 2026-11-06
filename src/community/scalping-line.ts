/**
 * Scalping Line Indicator
 *
 * Non-overlay oscillator: ScalpLine = SMA(close, signalPeriod) - ssMA
 * where ssMA is a double-smoothed SMA clamped to close when price moves beyond percent band.
 * Fill between ScalpLine and zero: green when >= 0, red when < 0.
 * As the original, ScalpLine exists from the first signal-line value (bar signalPeriod - 1): while the MA is na both
 * band tests are false, so ssMA = close; the zero line is drawn from the first bar. The MA reads the Source input,
 * the band tests, ssMA and the signal line read the close.
 * Alerts (alertcondition, `alerts` of the result): 'BUY ALARM!' / 'SELL ALARM!', ScalpLine crossing above / below 0.
 *
 * Reference: "Scalping Line Indicator" by KivancOzbilgic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface ScalpingLineInputs {
  src: SourceType;
  percent: number;
  mainPeriod: number;
  signalPeriod: number;
}

export const defaultInputs: ScalpingLineInputs = {
  src: 'close',
  percent: 1.0,
  mainPeriod: 100,
  signalPeriod: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'percent', type: 'float', title: 'Percent', defval: 1.0, min: 0, step: 0.1 },
  { id: 'mainPeriod', type: 'int', title: 'Main Period', defval: 100, min: 1 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 7, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scalp Line', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Scalping Line',
  shortTitle: 'SLI',
  overlay: false,
};

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface SlRun extends BarRunState<Record<string, never>> {
  sma1: WindowSma;
  sma2: WindowSma;
  signal: WindowSma;
  scalpArr: number[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ScalpingLineInputs>): BarStudy<SlRun, Result> {
  const { src, percent, mainPeriod, signalPeriod } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // MA = sma(sma(src, ceil(mainPeriod/2)), floor(mainPeriod/2) + 1)
  const halfUp = Math.ceil(mainPeriod / 2);
  const halfDown = Math.floor(mainPeriod / 2) + 1;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma1 = new WindowSma(halfUp);
      const sma2 = new WindowSma(halfDown);
      const signal = new WindowSma(signalPeriod);
      const s: SlRun = {
        sma1, sma2, signal, scalpArr: [], plot0: [], plot1: [], fillColors: [], flags: [[], []], times: [[], []],
        steps: [sma1, sma2, signal], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.scalpArr, s.plot0, s.plot1, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ma = s.sma2.step(s.sma1.step(value(b)));
      const c = b.close ?? NaN;
      // ssMA = MA > close + MA * percent / 100 ? MA : MA < close - MA * percent / 100 ? MA : close
      // (na MA: both tests false, ssMA = close)
      let ss: number;
      if (ma == null || isNaN(ma)) {
        ss = c;
      } else {
        const band = ma * percent / 100;
        if (ma > c + band) ss = ma;
        else if (ma < c - band) ss = ma;
        else ss = c;
      }
      // signalline = sma(close, signalPeriod)
      const sig = s.signal.step(b.close);
      // ScalpLine = signalline - ssMA
      const v = (sig != null && !isNaN(sig) && !isNaN(ss)) ? sig - ss : NaN;
      s.scalpArr[i] = v;
      s.plot0[i] = { time: b.time, value: v };
      // plot(0, "") on every bar
      s.plot1[i] = { time: b.time, value: 0 };
      // Fill colour: ScalpLine >= 0 ? green : red (transp 80); no fill where ScalpLine is na
      s.fillColors[i] = isNaN(v) ? 'transparent' : v >= 0 ? 'rgba(0,128,0,0.2)' : 'rgba(255,0,0,0.2)';
      // alertcondition(crossover(ScalpLine, 0), "BUY ALARM!") / alertcondition(crossunder(ScalpLine, 0), "SELL ALARM!")
      const pv = i > 0 ? s.scalpArr[i - 1] ?? NaN : NaN;
      const flags = [v > 0 && pv <= 0, v < 0 && pv >= 0];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,128,0,0.2)' }, colors: s.fillColors.slice() }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpingLineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ScalpingLineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY ALARM!', message: 'SLI BUY Signal!' },
  { id: 'alert1', title: 'SELL ALARM!', message: 'SLI SELL Signal!' },
];

export const ScalpingLine = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
