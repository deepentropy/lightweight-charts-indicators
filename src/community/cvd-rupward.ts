/**
 * CVD (Cumulative Volume Delta)
 *
 * The volume delta of a bar is its volume when the close is above the open, minus its volume when the close is below
 * the open (0 for a doji). The CVD is its cumulative sum, green when >= 0 and red otherwise, with three moving
 * averages of the CVD (SMA / EMA / WMA / VWMA / HMA, default HMA 34, WMA 89, SMA 816). The background is green when
 * the CVD is above 0, red otherwise.
 *
 * Alerts (alertcondition, `alerts` of the result): the CVD crossing above / below MA A (long / short signal) and MA B,
 * and the absolute volume delta at or above "Alert Threshold".
 *
 * Reference: "CVD (Cumulative Volume Delta)" by RUpward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'HMA';

export interface CvdRupwardInputs {
  showMovingAvg: boolean;
  maLengthA: number;
  maTypeA: MaType;
  maLengthB: number;
  maTypeB: MaType;
  maLengthC: number;
  maTypeC: MaType;
  colorPositive: string;
  colorNegative: string;
  colorA: string;
  colorB: string;
  colorC: string;
  /** Threshold of the volume delta alert (the 'Volume Delta Alert' condition only) */
  alertThreshold: number;
}

export const defaultInputs: CvdRupwardInputs = {
  showMovingAvg: true,
  maLengthA: 34,
  maTypeA: 'HMA',
  maLengthB: 89,
  maTypeB: 'WMA',
  maLengthC: 816,
  maTypeC: 'SMA',
  colorPositive: color.green,
  colorNegative: color.red,
  colorA: '#09c1ff',
  colorB: color.yellow,
  colorC: '#b667ff',
  alertThreshold: 100000,
};

const MA_TYPES: MaType[] = ['SMA', 'EMA', 'WMA', 'VWMA', 'HMA'];

export const inputConfig: InputConfig[] = [
  { id: 'showMovingAvg', type: 'bool', title: 'Show Moving Average', defval: true },
  { id: 'maLengthA', type: 'int', title: 'Moving Average Length_A', defval: 34, min: 1 },
  { id: 'maTypeA', type: 'string', title: 'Moving Average Type A', defval: 'HMA', options: MA_TYPES },
  { id: 'maLengthB', type: 'int', title: 'Moving Average Length_B', defval: 89, min: 1 },
  { id: 'maTypeB', type: 'string', title: 'Moving Average Type B', defval: 'WMA', options: MA_TYPES },
  { id: 'maLengthC', type: 'int', title: 'Moving Average Length_C', defval: 816, min: 1 },
  { id: 'maTypeC', type: 'string', title: 'Moving Average Type C', defval: 'SMA', options: MA_TYPES },
  { id: 'colorPositive', type: 'color', title: 'Positive CVD Color', defval: color.green },
  { id: 'colorNegative', type: 'color', title: 'Negative CVD Color', defval: color.red },
  { id: 'colorA', type: 'color', title: 'Line A Col', defval: '#09c1ff' },
  { id: 'colorB', type: 'color', title: 'Line B Col', defval: color.yellow },
  { id: 'colorC', type: 'color', title: 'Line C Col', defval: '#b667ff' },
  { id: 'alertThreshold', type: 'int', title: 'Alert Threshold', defval: 100000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CVD', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'MA A', color: '#09c1ff', lineWidth: 2 },
  { id: 'plot2', title: 'MA B', color: color.yellow, lineWidth: 1 },
  { id: 'plot3', title: 'MA C', color: '#b667ff', lineWidth: 2 },
];

export const metadata = {
  title: 'CVD (Cumulative Volume Delta)',
  shortTitle: 'CVD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface CvdRun extends BarRunState<Record<string, never>> {
  cum: ReturnType<typeof taStep.cum>;
  mas: Ma[];
  cvd: number[];
  ma: number[][];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CvdRupwardInputs>): BarStudy<CvdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // get_ma(src, ma_type, len): only the selected ta.* call runs (ma_type is an input)
  const getMa = (type: MaType, len: number): Ma => {
    switch (type) {
      case 'SMA': return new WindowSma(len);
      case 'EMA': return taStep.ema(len);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(len);
      case 'HMA':
        // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
        if (Math.floor(len / 2) < 1) throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        return taStep.hma(len);
      default: return { step: () => NaN, commit: () => {} };
    }
  };
  const bgPositive = String(color.new(cfg.colorPositive, 90));
  const bgNegative = String(color.new(cfg.colorNegative, 90));
  const colors = [cfg.colorA, cfg.colorB, cfg.colorC];
  return {
    init() {
      const mas = [getMa(cfg.maTypeA, cfg.maLengthA), getMa(cfg.maTypeB, cfg.maLengthB), getMa(cfg.maTypeC, cfg.maLengthC)];
      const s: CvdRun = {
        cum: taStep.cum(), mas, cvd: [], ma: [[], [], []], plots: [[], [], [], []], bgColors: [],
        flags: [[], [], [], [], []], times: [[], [], [], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.cum, ...mas];
      s.lists = s.times;
      s.series = [s.cvd, ...s.ma, ...s.plots, s.bgColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const volume = b.volume ?? NaN;
      // volume_delta = volume * (close > open ? 1 : 0) - volume * (close < open ? 1 : 0)
      const volumeDelta = volume * (gt(b.close, b.open) ? 1 : 0) - volume * (gt(b.open, b.close) ? 1 : 0);
      const cvd = s.cum.step(volumeDelta);
      s.cvd[i] = cvd;
      // plot(cvd, color = cvd >= 0 ? input_color_positive : input_color_negative, linewidth = 2)
      s.plots[0][i] = { time, value: cvd, color: ge(cvd, 0) ? cfg.colorPositive : cfg.colorNegative };
      for (let k = 0; k < 3; k++) {
        const m = s.mas[k].step(cvd, volume);
        s.ma[k][i] = m;
        s.plots[k + 1][i] = { time, value: cfg.showMovingAvg ? m : NaN, color: colors[k] };
      }
      // bgcolor(cvd > 0 ? color.new(input_color_positive, 90) : color.new(input_color_negative, 90))
      s.bgColors[i] = { time, color: gt(cvd, 0) ? bgPositive : bgNegative };

      // long_signal / short_signal = ta.crossover / ta.crossunder(cvd, ma_A); ma_cross_up / ma_cross_down with ma_B;
      // math.abs(volume_delta) >= input_alert_threshold
      const pc = i > 0 ? s.cvd[i - 1] : NaN;
      const a = s.ma[0][i];
      const pa = i > 0 ? s.ma[0][i - 1] : NaN;
      const m2 = s.ma[1][i];
      const pb = i > 0 ? s.ma[1][i - 1] : NaN;
      const f = s.flags;
      f[0][i] = cvd > a && pc <= pa;
      f[1][i] = cvd < a && pc >= pa;
      f[2][i] = cvd > m2 && pc <= pb;
      f[3][i] = cvd < m2 && pc >= pb;
      f[4][i] = ge(Math.abs(volumeDelta), cfg.alertThreshold);
      for (let k = 0; k < 5; k++) if (f[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CvdRupwardInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CvdRupwardInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'CVD Long Signal Alert', message: 'CVD Long Signal' },
  { id: 'alert1', title: 'CVD Short Signal Alert', message: 'CVD Short Signal' },
  { id: 'alert2', title: 'CVD Cross Up MA B Alert', message: 'MA Cross Up MA' },
  { id: 'alert3', title: 'CVD Cross Down MA B Alert', message: 'CVD Cross Down MA' },
  { id: 'alert4', title: 'Volume Delta Alert', message: 'Volume Delta exceeds threshold!' },
];

export const CvdRupward = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
