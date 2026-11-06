/**
 * Gann High Low
 *
 * SMA-based trend direction indicator, as the original: HLd = 1 when the close is above the previous SMA of the highs,
 * -1 when it is below the previous SMA of the lows (each taken as 0 while it is na), else 0; HLv = the last non-zero
 * HLd. The line is the SMA of the highs (maroon) when HLv = -1, else the SMA of the lows (blue), from the first bar
 * where that SMA exists.
 * Alerts (alertcondition, `alerts` of the result): the close crossing the HiLo line (either way, over, under), on the
 * original's HiLo series.
 *
 * Reference: "Gann High Low" by KivancOzbilgic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GannHighLowInputs {
  highLength: number;
  lowLength: number;
}

export const defaultInputs: GannHighLowInputs = {
  highLength: 13,
  lowLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'highLength', type: 'int', title: 'High Length', defval: 13, min: 1 },
  { id: 'lowLength', type: 'int', title: 'Low Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GannHL', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Gann High Low',
  shortTitle: 'GannHL',
  overlay: true,
};

// Colour constants of Pine version 5
const MAROON = '#880E4F';
const BLUE = '#2962FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface GannVars {
  /** HLv = ta.valuewhen(HLd != 0, HLd, 0) */
  hlv: number;
}

interface GannRun extends BarRunState<GannVars> {
  smaHigh: WindowSma;
  smaLow: WindowSma;
  smaHighArr: number[];
  smaLowArr: number[];
  hiLo: number[];
  plot: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<GannHighLowInputs>): BarStudy<GannRun, Result> {
  const { highLength, lowLength } = { ...defaultInputs, ...inputs };
  const nz = (v: number | null | undefined) => (v == null || isNaN(v) ? 0 : v);
  return {
    init() {
      const smaHigh = new WindowSma(highLength);
      const smaLow = new WindowSma(lowLength);
      const s: GannRun = {
        smaHigh, smaLow, smaHighArr: [], smaLowArr: [], hiLo: [], plot: [], flags: [[], [], []], times: [[], [], []],
        steps: [smaHigh, smaLow], vars: { hlv: NaN }, lists: [], series: [],
      };
      s.lists = [...s.times];
      s.series = [s.smaHighArr, s.smaLowArr, s.hiLo, s.plot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const smaHigh = s.smaHigh.step(b.high);
      const smaLow = s.smaLow.step(b.low);
      s.smaHighArr[i] = smaHigh;
      s.smaLowArr[i] = smaLow;
      // Alerts on the original's HiLo: HLd = close > nz(sma(high))[1] ? 1 : close < nz(sma(low))[1] ? -1 : 0,
      // HLv = ta.valuewhen(HLd != 0, HLd, 0), HiLo = HLv == -1 ? sma(high) : sma(low)
      const pH = i > 0 ? nz(s.smaHighArr[i - 1]) : NaN;
      const pL = i > 0 ? nz(s.smaLowArr[i - 1]) : NaN;
      const hld = gt(close, pH) ? 1 : lt(close, pL) ? -1 : 0;
      if (hld !== 0) s.vars.hlv = hld;
      const hlv = s.vars.hlv;
      const hiLo = (hlv === -1 ? smaHigh : smaLow) ?? NaN;
      s.hiLo[i] = hiLo;
      // plot(HiLo, linewidth = 2, color = HLv == -1 ? color.maroon : color.blue)
      s.plot[i] = { time: b.time, value: hiLo, color: hlv === -1 ? MAROON : BLUE };

      // ta.crossover(close, HiLo) / ta.crossunder(close, HiLo): plain comparisons, na compares false
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const ph = i > 0 ? s.hiLo[i - 1] : NaN;
      const up = close > hiLo && pc <= ph;
      const down = close < hiLo && pc >= ph;
      // alertcondition(ta.cross(close, HiLo)) / ta.crossover(close, HiLo) / ta.crossunder(close, HiLo)
      [up || down, up, down].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GannHighLowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GannHighLowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Cross Alert', message: 'Price - HiLo Crossing!' },
  { id: 'alert1', title: 'PRICE CrossOver Alarm', message: 'LAST PRICE is ABOVE HiLo' },
  { id: 'alert2', title: 'PRICE CrossUnder Alarm', message: 'LAST PRICE is BELOW HiLo!' },
];

export const GannHighLow = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
