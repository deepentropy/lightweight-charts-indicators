/**
 * Trend Strength/Direction
 *
 * Six Hull moving averages of the close (lengths 20, 40, 60, 80, 100 and a custom length 5), each computed as
 * wma(2 * wma(close, round(len / 2)) - wma(close, len), round(sqrt(len))). Each line is the angle of its HMA:
 * atan(hma - hma[1]) in degrees. A dotted zero line and a grey fill between the +45 and -45 levels.
 * Alerts (alertcondition, `alerts` of the result): the angle of HMA 1 above 45 and below -45.
 *
 * Reference: "Trend Strength/Direction" by ddcakez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendStrengthDirectionInputs {
  hmaLength1: number;
  hmaLength2: number;
  hmaLength3: number;
  hmaLength4: number;
  hmaLength5: number;
  /** Custom HMA length */
  hmaLengthCustom: number;
  /** Label of the custom HMA (not used in the outputs) */
  hmaCustomLabel: string;
}

export const defaultInputs: TrendStrengthDirectionInputs = {
  hmaLength1: 20,
  hmaLength2: 40,
  hmaLength3: 60,
  hmaLength4: 80,
  hmaLength5: 100,
  hmaLengthCustom: 5,
  hmaCustomLabel: 'Custom HMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'hmaLength1', type: 'int', title: 'HMA Length 1', defval: 20, min: 1 },
  { id: 'hmaLength2', type: 'int', title: 'HMA Length 2', defval: 40, min: 1 },
  { id: 'hmaLength3', type: 'int', title: 'HMA Length 3', defval: 60, min: 1 },
  { id: 'hmaLength4', type: 'int', title: 'HMA Length 4', defval: 80, min: 1 },
  { id: 'hmaLength5', type: 'int', title: 'HMA Length 5', defval: 100, min: 1 },
  { id: 'hmaLengthCustom', type: 'int', title: 'Custom HMA Length', defval: 5, min: 1 },
  { id: 'hmaCustomLabel', type: 'string', title: 'Custom HMA Label', defval: 'Custom HMA' },
];

const PLOT_COLORS = [color.blue, color.green, color.orange, color.purple, color.red, '#80807c'];
const PLOT_TITLES = ['HMA Angle 1', 'HMA Angle 2', 'HMA Angle 3', 'HMA Angle 4', 'HMA Angle 5', 'Custom HMA Angle'];

export const plotConfig: PlotConfig[] = PLOT_TITLES.map((title, k) => ({
  id: `plot${k}`, title, color: PLOT_COLORS[k], lineWidth: 2,
}));

/** Pine hline default colour */
const HLINE_COLOR = '#787B86';

/** hline(0, "Zero Line"), and hline(45) / hline(-45) (Pine defaults: title "Level", dashed) for the fill */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: color.gray, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline_upper', price: 45, title: 'Level', color: HLINE_COLOR, linestyle: 'dashed' },
  { id: 'hline_lower', price: -45, title: 'Level', color: HLINE_COLOR, linestyle: 'dashed' },
];

/** fill(hline(45), hline(-45), color.new(color.gray, 90), "Angle Range Fill") */
export const fillConfig: FillConfig[] = [
  { id: 'fill_angle', plot1: 'hline_upper', plot2: 'hline_lower', color: String(color.new(color.gray, 90)), title: 'Angle Range Fill' },
];

export const metadata = {
  title: 'Trend Strength/Direction',
  shortTitle: 'Trend Strength/Direction',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

/** One calculateHMA(close, length) call: the three ta.wma machines and the HMA of the bar before */
interface Hma {
  half: number;
  root: number;
  len: number;
  wma1: ReturnType<typeof taStep.wma>;
  wma2: ReturnType<typeof taStep.wma>;
  wma3: ReturnType<typeof taStep.wma>;
  /** the HMA of every bar (hma[1]) */
  hma: number[];
}

interface TsdRun extends BarRunState<Record<string, never>> {
  hmas: Hma[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

const ANGLE_FILL = String(color.new(color.gray, 90));

function study(inputs: Partial<TrendStrengthDirectionInputs>): BarStudy<TsdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.hmaLength1, cfg.hmaLength2, cfg.hmaLength3, cfg.hmaLength4, cfg.hmaLength5, cfg.hmaLengthCustom];
  return {
    init() {
      const hmas: Hma[] = lengths.map((len) => ({
        half: Math.round(len / 2), root: Math.round(Math.sqrt(len)), len,
        wma1: taStep.wma(), wma2: taStep.wma(), wma3: taStep.wma(), hma: [],
      }));
      const s: TsdRun = {
        hmas, plots: lengths.map(() => []), flags: [[], []], times: [[], []],
        steps: hmas.flatMap((h) => [h.wma1, h.wma2, h.wma3]), vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [...hmas.map((h) => h.hma), ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      let angle1 = NaN;
      s.hmas.forEach((h, k) => {
        // calculateHMA(source, length): wma(2 * wma(source, round(length / 2)) - wma(source, length), round(sqrt(length)))
        const diff = 2 * h.wma1.step(close, h.half) - h.wma2.step(close, h.len);
        const v = h.wma3.step(diff, h.root);
        h.hma[i] = v;
        // calculateAngle(hma) = math.atan(hma - hma[1]) * 180 / math.pi
        const raw = (Math.atan(v - (i > 0 ? h.hma[i - 1] : NaN)) * 180) / Math.PI;
        const a = Number.isFinite(raw) ? raw : NaN;
        if (k === 0) angle1 = a;
        s.plots[k][i] = { time: b.time, value: a, color: PLOT_COLORS[k] };
      });
      // alertcondition(hmaAngle1 > angleLevelUpper) / alertcondition(hmaAngle1 < angleLevelLower), levels 45 / -45
      [angle1 > 45, angle1 < -45].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: hlineConfig.map((h) => ({
          value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth ?? 1 },
        })),
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Angle Range Fill' },
            colors: new Array<string>(n).fill(ANGLE_FILL) },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendStrengthDirectionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendStrengthDirectionInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'HMA1 Above Upper Angle Level', message: 'HMA Angle 1 is above the upper angle level' },
  { id: 'alert1', title: 'HMA1 Below Lower Angle Level', message: 'HMA Angle 1 is below the lower angle level' },
];

export const TrendStrengthDirection = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
