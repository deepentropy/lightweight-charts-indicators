/**
 * AO_AC_ZONE (Customizable)
 *
 * Awesome Oscillator AO = MA(price, fast) - MA(price, slow) and Accelerator Oscillator AC = AO - MA(AO, acLength),
 * with a choice of moving average (SMA, EMA, RMA, WMA, VWMA) and of price. The Zone histogram is the AO, green when
 * AO and AC both rise, red when both fall, gray otherwise; the bars take the Zone colour. AO (aqua when rising,
 * navy otherwise) and AC (fuchsia when rising, purple otherwise) are hidden by default.
 *
 * Reference: "AO_AC_ZONE (Customizable)" by pirooz_trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { WindowSma, WindowVwma, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AoAcZoneMaType = 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'VWMA';
export type AoAcZonePriceType = 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'lhcc4' | 'open' | 'high' | 'low';

export interface AwesomeAcceleratorZoneOscillatorInputs {
  hideAwesome: boolean;
  hideAccelerator: boolean;
  hideZone: boolean;
  /** Do not colour the bars with the Zone colour */
  hideZoneBarsColor: boolean;
  maType: AoAcZoneMaType;
  /** Fast MA length of the AO */
  fastLength: number;
  /** Slow MA length of the AO */
  slowLength: number;
  /** MA length of the AC */
  acLength: number;
  /** Price; lhcc4 = (low + high + close + close) / 4 */
  priceType: AoAcZonePriceType;
}

export const defaultInputs: AwesomeAcceleratorZoneOscillatorInputs = {
  hideAwesome: true,
  hideAccelerator: true,
  hideZone: false,
  hideZoneBarsColor: false,
  maType: 'SMA',
  fastLength: 5,
  slowLength: 34,
  acLength: 5,
  priceType: 'hl2',
};

export const inputConfig: InputConfig[] = [
  { id: 'hideAwesome', type: 'bool', title: 'Hide AO', defval: true },
  { id: 'hideAccelerator', type: 'bool', title: 'Hide AC', defval: true },
  { id: 'hideZone', type: 'bool', title: 'Hide Zone Histogram', defval: false },
  { id: 'hideZoneBarsColor', type: 'bool', title: 'Hide Zone Trading Color on Bars', defval: false },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA', 'RMA', 'WMA', 'VWMA'] },
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 34, min: 1 },
  { id: 'acLength', type: 'int', title: 'AC MA Length', defval: 5, min: 1 },
  { id: 'priceType', type: 'string', title: 'Price Type', defval: 'hl2', options: ['close', 'hl2', 'hlc3', 'ohlc4', 'lhcc4', 'open', 'high', 'low'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: color.aqua, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'AC', color: color.fuchsia, lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Zone', color: color.green, lineWidth: 2, style: 'columns' },
];

export const metadata = {
  title: 'AO_AC_ZONE (Customizable)',
  shortTitle: 'AO_AC_ZONE',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };

/** ma(source, length) stepped bar by bar: step(value, volume) */
interface MaStep {
  step(value: number, volume: number): number;
  commit(): void;
}

/** ma(source, length): the moving average of the selected type (na for an unknown type) */
function maStep(maType: AoAcZoneMaType, length: number): MaStep {
  switch (maType) {
    case 'SMA': {
      const m = new WindowSma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'EMA': return taStep.ema(length);
    case 'RMA': return taStep.rma(length);
    case 'WMA': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, length), commit: () => m.commit() };
    }
    case 'VWMA': return new WindowVwma(length);
    default: return { step: () => NaN, commit: () => {} };
  }
}

interface AoAcRun extends BarRunState<{ ao1: number; ac1: number }> {
  fast: MaStep;
  slow: MaStep;
  acMa: MaStep;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<AwesomeAcceleratorZoneOscillatorInputs>): BarStudy<AoAcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const priceOf = (b: Bar): number => {
    switch (cfg.priceType) {
      case 'close': return b.close;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
      case 'lhcc4': return (b.low + b.high + b.close + b.close) / 4;
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      default: return NaN;
    }
  };
  return {
    init() {
      const fast = maStep(cfg.maType, cfg.fastLength);
      const slow = maStep(cfg.maType, cfg.slowLength);
      const acMa = maStep(cfg.maType, cfg.acLength);
      const s: AoAcRun = {
        fast, slow, acMa, plots: [[], [], []], barColors: [],
        steps: [fast, slow, acMa],
        vars: { ao1: NaN, ac1: NaN },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      const price = priceOf(b);
      const ao = s.fast.step(price, volume) - s.slow.step(price, volume);
      const ac = ao - s.acMa.step(ao, volume);
      const ao1 = i > 0 ? v.ao1 : NaN;
      const ac1 = i > 0 ? v.ac1 : NaN;
      const aoColor = gt(ao, ao1) ? color.aqua : color.navy;
      const acColor = gt(ac, ac1) ? color.fuchsia : color.purple;
      const zoneColor = gt(ao, ao1) && gt(ac, ac1) ? color.green
        : lt(ao, ao1) && lt(ac, ac1) ? color.red : color.gray;
      // barcolor(not hideZoneBarsColor ? zoneColor : na)
      if (!cfg.hideZoneBarsColor) s.barColors.push({ time: t, color: zoneColor });
      s.plots[0][i] = { time: t, value: !cfg.hideAwesome ? ao : NaN, color: aoColor };
      s.plots[1][i] = { time: t, value: !cfg.hideAccelerator ? ac : NaN, color: acColor };
      s.plots[2][i] = { time: t, value: !cfg.hideZone ? ao : NaN, color: zoneColor };
      v.ao1 = ao;
      v.ac1 = ac;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dotted' } }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AwesomeAcceleratorZoneOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AwesomeAcceleratorZoneOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AwesomeAcceleratorZoneOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
