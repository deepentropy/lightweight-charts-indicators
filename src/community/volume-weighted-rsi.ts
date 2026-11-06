/**
 * Volume Weighted RSI (VW RSI)
 *
 * An RSI of volume: the volume of an up close (close > close[1]) and of a down close are averaged with an RMA of
 * `length` bars; VW RSI = 100 - 100 / (1 + avgUp / avgDown). The line is green above 50, red below 50, gray at 50.
 * Horizontal lines at 50 and at the overbought / oversold levels; a red background above the overbought level and a
 * green background below the oversold level.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): VW RSI crossing over / under 50, over the
 * overbought level and under the oversold level.
 *
 * Reference: "Volume Weighted RSI (VW RSI)" by CsokosGeza
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface VolumeWeightedRsiInputs {
  /** Period of the Volume Weighted RSI */
  length: number;
  overbought: number;
  oversold: number;
  showCenterline: boolean;
  showOverboughtOversold: boolean;
}

export const defaultInputs: VolumeWeightedRsiInputs = {
  length: 14,
  overbought: 70,
  oversold: 30,
  showCenterline: true,
  showOverboughtOversold: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'VW RSI Length', defval: 14, min: 1, step: 1 },
  { id: 'overbought', type: 'float', title: 'Overbought Level', defval: 70, min: 50, max: 100, step: 1 },
  { id: 'oversold', type: 'float', title: 'Oversold Level', defval: 30, min: 0, max: 50, step: 1 },
  { id: 'showCenterline', type: 'bool', title: 'Show Centerline', defval: true },
  { id: 'showOverboughtOversold', type: 'bool', title: 'Show Overbought/Oversold Lines', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VW RSI', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume Weighted RSI (VW RSI)',
  shortTitle: 'Volume Weighted RSI (VW RSI)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { bgColors: BgColorData[]; alertCalls: AlertCall[] };
type Point = { time: number; value: number; color?: string };

interface VwRun extends BarRunState<Record<string, never>> {
  avgUp: ReturnType<typeof taStep.rma>;
  avgDown: ReturnType<typeof taStep.rma>;
  rsi: number[];
  plot0: Point[];
  bgColors: BgColorData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<VolumeWeightedRsiInputs>): BarStudy<VwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const obBg = String(color.new(color.red, 90));
  const osBg = String(color.new(color.green, 90));
  const messages = [
    'VW RSI Bullish: Crossed above 50',
    'VW RSI Bearish: Crossed below 50',
    'VW RSI Overbought: Crossed above ' + str.tostring(cfg.overbought),
    'VW RSI Oversold: Crossed below ' + str.tostring(cfg.oversold),
  ];
  return {
    init() {
      const avgUp = taStep.rma(cfg.length);
      const avgDown = taStep.rma(cfg.length);
      const s: VwRun = {
        avgUp, avgDown, rsi: [], plot0: [], bgColors: [], alertCalls: [],
        steps: [avgUp, avgDown], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.alertCalls];
      s.series = [s.rsi, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      // up_volume = close > close[1] ? volume : 0 (close[1] na on the first bar: 0)
      const vol = b.volume ?? NaN;
      const upVolume = i > 0 && gt(b.close, bars[i - 1].close) ? vol : 0;
      const downVolume = i > 0 && lt(b.close, bars[i - 1].close) ? vol : 0;
      const avgUp = s.avgUp.step(upVolume);
      const avgDown = s.avgDown.step(downVolume);
      // A plain division: x / 0 is +-infinity (VW RSI 100), 0 / 0 is na
      const vwRs = avgUp / avgDown;
      const vwRsi = 100 - 100 / (1 + vwRs);
      s.rsi[i] = vwRsi;
      const c = gt(vwRsi, 50) ? color.green : lt(vwRsi, 50) ? color.red : color.gray;
      s.plot0[i] = { time, value: Number.isFinite(vwRsi) ? vwRsi : NaN, color: c };
      if (gt(vwRsi, cfg.overbought)) s.bgColors.push({ time, color: obBg });
      else if (lt(vwRsi, cfg.oversold)) s.bgColors.push({ time, color: osBg });

      // if ta.crossover(vw_rsi, 50) alert(...) ... (alert.freq_once_per_bar), in the order of the original
      const pv = i > 0 ? s.rsi[i - 1] : NaN;
      if (vwRsi > 50 && pv <= 50) s.alertCalls.push({ time, message: messages[0], freq: 'once_per_bar' });
      if (vwRsi < 50 && pv >= 50) s.alertCalls.push({ time, message: messages[1], freq: 'once_per_bar' });
      if (vwRsi > cfg.overbought && pv <= cfg.overbought) s.alertCalls.push({ time, message: messages[2], freq: 'once_per_bar' });
      if (vwRsi < cfg.oversold && pv >= cfg.oversold) s.alertCalls.push({ time, message: messages[3], freq: 'once_per_bar' });
    },
    result(s) {
      // hline(show ? level : na): an na level draws no line
      const hlines = [];
      if (cfg.showCenterline) {
        hlines.push({ value: 50, options: { title: 'Centerline', color: color.gray, linestyle: 'dashed' as const } });
      }
      if (cfg.showOverboughtOversold) {
        hlines.push({ value: cfg.overbought, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' as const } });
        hlines.push({ value: cfg.oversold, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' as const } });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines,
        bgColors: s.bgColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeWeightedRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
