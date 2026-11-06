/**
 * IIR One-Pole Price Filter
 *
 * A one-pole IIR low-pass filter of the source: y = y[1] + alpha * (src - y[1]), started at the source. Alpha comes
 * from an EMA length (2 / (L + 1)), a half-life (1 - exp(-ln 2 / HL)) or a cutoff period (1 - exp(-2 pi / Pc)),
 * times a scale, clamped to 0.0001..0.9999. The line and the candles are green while the filter rises and red
 * otherwise.
 *
 * Alerts (alertcondition, `alerts` of the result): 'IIR One-Pole Long' when the filter crosses above its value of the
 * bar before (ta.crossover(y, y[1])), 'IIR One-Pole Short' when it crosses under it.
 *
 * Reference: "IIR One-Pole Price Filter [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IirOnePolePriceFilterInputs {
  src: SourceType;
  /** How alpha is set: 'EMA-Length', 'Half-Life' or 'Cutoff-Period' */
  mode: 'EMA-Length' | 'Half-Life' | 'Cutoff-Period';
  /** Length (EMA-Length mode) */
  L: number;
  /** Half-life in bars (Half-Life mode) */
  HL: number;
  /** Cutoff period in bars (Cutoff-Period mode) */
  Pc: number;
  /** Factor applied to alpha */
  alphaScale: number;
  showLine: boolean;
  paintCandles: boolean;
  longColor: string;
  shortColor: string;
  /** Line width (the plot width is static in the port: 4) */
  lineW: number;
  /** Line transparency */
  transp: number;
}

export const defaultInputs: IirOnePolePriceFilterInputs = {
  src: 'hl2',
  mode: 'EMA-Length',
  L: 20,
  HL: 20,
  Pc: 60,
  alphaScale: 1.0,
  showLine: true,
  paintCandles: true,
  longColor: '#33ff00',
  shortColor: '#ff0000',
  lineW: 4,
  transp: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Price Source', defval: 'hl2' },
  { id: 'mode', type: 'string', title: 'Alpha Mode', defval: 'EMA-Length', options: ['EMA-Length', 'Half-Life', 'Cutoff-Period'] },
  { id: 'L', type: 'int', title: 'Length (EMA-Style)', defval: 20, min: 1 },
  { id: 'HL', type: 'int', title: 'Half-Life (bars)', defval: 20, min: 1 },
  { id: 'Pc', type: 'int', title: 'Cutoff Period (bars)', defval: 60, min: 2 },
  { id: 'alphaScale', type: 'float', title: 'Alpha Scale', defval: 1.0, min: 0.01, step: 0.01 },
  { id: 'showLine', type: 'bool', title: 'Show Filter on chart?', defval: true },
  { id: 'paintCandles', type: 'bool', title: 'Paint candles according to Trend?', defval: true },
  { id: 'longColor', type: 'color', title: 'Long Color', defval: '#33ff00' },
  { id: 'shortColor', type: 'color', title: 'Short Color', defval: '#ff0000' },
  { id: 'lineW', type: 'int', title: 'Line Wdith', defval: 4 },
  { id: 'transp', type: 'int', title: 'Line Transparency', defval: 40 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'One-Pole', color: String(color.new('#33ff00', 40)), lineWidth: 4 },
];

export const metadata = {
  title: 'IIR One-Pole Price Filter [BackQuant]',
  shortTitle: 'IIR One-Pole Price Filter [BackQuant]',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface IirRun extends BarRunState<Record<string, never>> {
  ys: number[];
  plot0: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<IirOnePolePriceFilterInputs>): BarStudy<IirRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  const alphaEma = 2.0 / (cfg.L + 1.0);
  const alphaHl = 1.0 - Math.exp(-Math.log(2.0) / cfg.HL);
  const alphaCut = 1.0 - Math.exp(-(2.0 * Math.PI) / cfg.Pc);
  const alphaRaw = cfg.mode === 'EMA-Length' ? alphaEma : cfg.mode === 'Half-Life' ? alphaHl : alphaCut;
  const alpha = Math.min(0.9999, Math.max(0.0001, alphaRaw * cfg.alphaScale));

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: IirRun = {
        ys: [], plot0: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.ys, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const src = value(b);
      const yPrev = i > 0 ? s.ys[i - 1]! : NaN; // y[1]
      // prev = nz(y[1], src); y := prev + alpha * (src - prev)
      const prev = isNaN(yPrev) ? src : yPrev;
      const y = prev + alpha * (src - prev);
      s.ys[i] = y;
      // up = y > nz(y[1], y)
      const up = gt(y, isNaN(yPrev) ? y : yPrev);
      const barCol = up ? cfg.longColor : cfg.shortColor;
      // barcolor(paintCandles ? barCol : na)
      if (cfg.paintCandles) s.barColors.push({ time: b.time, color: barCol });
      // plot(showLine ? y : na, "One-Pole", color.new(barCol, transp), linewidth = lineW)
      s.plot0[i] = { time: b.time as number, value: cfg.showLine ? y : NaN, color: String(color.new(barCol, cfg.transp)) };
      // longFlip = ta.crossover(y, y[1]) / shortFlip = ta.crossunder(y, y[1])
      const y1 = i > 0 ? s.ys[i - 1]! : NaN;
      const y2 = i > 1 ? s.ys[i - 2]! : NaN;
      const flags = [y > yPrev && y1 <= y2, y < yPrev && y1 >= y2];
      flags.forEach((f, k) => {
        s.flags[k]![i] = f;
        if (f) s.times[k]!.push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IirOnePolePriceFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IirOnePolePriceFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'IIR One-Pole Long', message: 'IIR One-Pole Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'IIR One-Pole Short', message: 'IIR One-Pole Short {{exchange}}:{{ticker}}' },
];

export const IirOnePolePriceFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
