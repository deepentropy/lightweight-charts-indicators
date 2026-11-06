/**
 * Source-Aligned Oscillators (for Divergences)
 *
 * One oscillator (RSI, ROC, Momentum, MACD histogram, CMO or Stoch RSI %K) computed on a source chosen by the source
 * mode. The split modes compute it twice: a bullish line on the low (or the body low) and a bearish line on the high
 * (or the body high), to read divergences against the matching price extreme. Stoch RSI adds %D lines (SMA of %K).
 * Reference lines: the midline (0 or 50), 70 / 30 for the RSI family, +50 / -50 for CMO.
 *
 * Reference: "Oscillators for Divergences" by QuantNomad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type SourceAlignedOscType = 'RSI' | 'ROC' | 'Momentum' | 'MACD' | 'CMO' | 'Stoch RSI';
export type SourceAlignedSrcMode = 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'High/Low Split' | 'Body High/Low Split';

export interface SourceAlignedOscillatorsInputs {
  oscType: SourceAlignedOscType;
  srcMode: SourceAlignedSrcMode;
  showBull: boolean;
  showBear: boolean;
  showStochD: boolean;
  rsiLen: number;
  rocLen: number;
  momLen: number;
  cmoLen: number;
  stochLen: number;
  smoothK: number;
  smoothD: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: SourceAlignedOscillatorsInputs = {
  oscType: 'RSI',
  srcMode: 'Close',
  showBull: true,
  showBear: true,
  showStochD: true,
  rsiLen: 14,
  rocLen: 14,
  momLen: 10,
  cmoLen: 14,
  stochLen: 14,
  smoothK: 3,
  smoothD: 3,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'oscType', type: 'string', title: 'Oscillator', defval: 'RSI', options: ['RSI', 'ROC', 'Momentum', 'MACD', 'CMO', 'Stoch RSI'] },
  { id: 'srcMode', type: 'string', title: 'Source Mode', defval: 'Close', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'High/Low Split', 'Body High/Low Split'] },
  { id: 'showBull', type: 'bool', title: 'Show Bullish Line', defval: true },
  { id: 'showBear', type: 'bool', title: 'Show Bearish Line', defval: true },
  { id: 'showStochD', type: 'bool', title: 'Show Stoch RSI %D', defval: true },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rocLen', type: 'int', title: 'ROC Length', defval: 14, min: 1 },
  { id: 'momLen', type: 'int', title: 'Momentum Length', defval: 10, min: 1 },
  { id: 'cmoLen', type: 'int', title: 'CMO Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch RSI Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: 'Stoch RSI %K Smoothing', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Stoch RSI %D Smoothing', defval: 3, min: 1 },
  { id: 'macdFast', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
];

const MID_COL = String(color.new(color.gray, 60));
const RSI_LEVEL_COL = String(color.new(color.gray, 80));
const CMO_LEVEL_COL = String(color.new(color.gray, 85));
const OSC_COL = String(color.new(color.aqua, 0));
const BULL_COL = String(color.new(color.lime, 0));
const BEAR_COL = String(color.new(color.red, 0));
const D_COL = String(color.new(color.orange, 0));
const D_BULL_COL = String(color.new(color.green, 50));
const D_BEAR_COL = String(color.new(color.maroon, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: MID_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Upper 70', color: RSI_LEVEL_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower 30', color: RSI_LEVEL_COL, lineWidth: 1 },
  { id: 'plot3', title: 'CMO +50', color: CMO_LEVEL_COL, lineWidth: 1 },
  { id: 'plot4', title: 'CMO -50', color: CMO_LEVEL_COL, lineWidth: 1 },
  { id: 'plot5', title: 'Oscillator', color: OSC_COL, lineWidth: 2 },
  { id: 'plot6', title: 'Bullish Source Line', color: BULL_COL, lineWidth: 2 },
  { id: 'plot7', title: 'Bearish Source Line', color: BEAR_COL, lineWidth: 2 },
  { id: 'plot8', title: 'Stoch RSI %D', color: D_COL, lineWidth: 1 },
  { id: 'plot9', title: 'Stoch RSI %D Bull', color: D_BULL_COL, lineWidth: 1 },
  { id: 'plot10', title: 'Stoch RSI %D Bear', color: D_BEAR_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Oscillators for Divergences',
  shortTitle: 'OscDiv',
  overlay: false,
};

/** Pine a != b: false when the values are within 1e-10 or one is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > 1e-10;

type Osc = Committable & { step(v: number): number };
type Point = { time: number; value: number; color: string };

/**
 * `ta.cmo(source, length)` one bar at a time: mom = ta.change(src), 100 * (sm1 - sm2) / (sm1 + sm2) of the math.sum of
 * the gains and losses (the doubles of the oakscriptjs array function; an na change adds 0 to sm1 and na to sm2)
 */
class CmoStep implements Committable {
  private readonly up: WindowSum;
  private readonly down: WindowSum;
  private prev = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length check of ta.cmo (the same runtime error)
    taCore.cmo([], length);
    this.up = new WindowSum(length);
    this.down = new WindowSum(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const mom = value - this.prev;
    const s1 = this.up.step(mom >= 0 ? mom : 0);
    const s2 = this.down.step(mom >= 0 ? 0 : -mom);
    return (100 * (s1 - s2)) / (s1 + s2);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.pending;
    this.up.commit();
    this.down.commit();
  }
}

interface SaoRun extends BarRunState<Record<string, never>> {
  bullOsc: Osc;
  bearOsc: Osc;
  bullD: WindowSma | null;
  bearD: WindowSma | null;
  plots: Point[][];
}

function study(inputs: Partial<SourceAlignedOscillatorsInputs>): BarStudy<SaoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };

  const isSplitSource = cfg.srcMode === 'High/Low Split' || cfg.srcMode === 'Body High/Low Split';
  const pick = (b: Bar, split: 'bull' | 'bear'): number => {
    switch (cfg.srcMode) {
      case 'HL2': return (b.high + b.low) / 2;
      case 'HLC3': return (b.high + b.low + b.close) / 3;
      case 'OHLC4': return (b.open + b.high + b.low + b.close) / 4;
      case 'High/Low Split': return split === 'bull' ? b.low : b.high;
      case 'Body High/Low Split': return split === 'bull' ? Math.min(b.open, b.close) : Math.max(b.open, b.close);
      default: return b.close;
    }
  };

  // f_get_osc(_src): the oscillator type is fixed for the run, so each ta.* call runs on every bar
  const getOsc = (): Osc => {
    switch (cfg.oscType) {
      case 'RSI': return taStep.rsi(cfg.rsiLen);
      case 'ROC': return taStep.roc(cfg.rocLen);
      case 'Momentum': return taStep.mom(cfg.momLen);
      case 'MACD': {
        const fast = taStep.ema(cfg.macdFast);
        const slow = taStep.ema(cfg.macdSlow);
        const signal = taStep.ema(cfg.macdSignal);
        return {
          step: (v) => {
            const macdLine = fast.step(v) - slow.step(v);
            return macdLine - signal.step(macdLine);
          },
          commit: () => { fast.commit(); slow.commit(); signal.commit(); },
        };
      }
      case 'CMO': return new CmoStep(cfg.cmoLen);
      case 'Stoch RSI': {
        const rsi = taStep.rsi(cfg.rsiLen);
        const lowest = new WindowExtreme(true, cfg.stochLen);
        const highest = new WindowExtreme(false, cfg.stochLen);
        const k = new WindowSma(cfg.smoothK);
        return {
          step: (v) => {
            const rsiValue = rsi.step(v);
            const lowestRsi = lowest.step(rsiValue);
            const highestRsi = highest.step(rsiValue);
            // rawK = highestRsi != lowestRsi ? 100 * (rsiValue - lowestRsi) / (highestRsi - lowestRsi) : na
            const rawK = ne(highestRsi, lowestRsi) ? (100 * (rsiValue - lowestRsi)) / (highestRsi - lowestRsi) : NaN;
            return k.step(rawK);
          },
          commit: () => { rsi.commit(); lowest.commit(); highest.commit(); k.commit(); },
        };
      }
      default: return { step: () => NaN, commit: () => {} };
    }
  };

  const isStoch = cfg.oscType === 'Stoch RSI';
  const isRsiFamily = cfg.oscType === 'RSI' || isStoch;
  const isCMO = cfg.oscType === 'CMO';
  const isZeroBased = cfg.oscType === 'ROC' || cfg.oscType === 'Momentum' || cfg.oscType === 'MACD' || isCMO;
  const midValue = isZeroBased ? 0.0 : 50.0;

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const showOsc = !isSplitSource && cfg.showBull;
  const showBullLine = isSplitSource && cfg.showBull;
  const showBearLine = isSplitSource && cfg.showBear;
  const showD = isStoch && cfg.showStochD;
  const colors = [MID_COL, RSI_LEVEL_COL, RSI_LEVEL_COL, CMO_LEVEL_COL, CMO_LEVEL_COL, OSC_COL, BULL_COL, BEAR_COL, D_COL, D_BULL_COL, D_BEAR_COL];

  return {
    init() {
      const bullOsc = getOsc();
      const bearOsc = getOsc();
      const bullD = isStoch ? new WindowSma(cfg.smoothD) : null;
      const bearD = isStoch ? new WindowSma(cfg.smoothD) : null;
      const s: SaoRun = {
        bullOsc, bearOsc, bullD, bearD, plots: colors.map(() => []),
        steps: [bullOsc, bearOsc, ...(bullD ? [bullD] : []), ...(bearD ? [bearD] : [])], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const bullOsc = s.bullOsc.step(pick(b, 'bull'));
      const bearOsc = s.bearOsc.step(pick(b, 'bear'));
      const stochBullD = s.bullD ? s.bullD.step(bullOsc) : NaN;
      const stochBearD = s.bearD ? s.bearD.step(bearOsc) : NaN;
      const put = (k: number, v: number) => { s.plots[k][i] = { time, value: fin(v), color: colors[k] }; };
      put(0, midValue);
      put(1, isRsiFamily ? 70 : NaN);
      put(2, isRsiFamily ? 30 : NaN);
      put(3, isCMO ? 50 : NaN);
      put(4, isCMO ? -50 : NaN);
      put(5, showOsc ? bullOsc : NaN);
      put(6, showBullLine ? bullOsc : NaN);
      put(7, showBearLine ? bearOsc : NaN);
      put(8, showD && !isSplitSource && cfg.showBull ? stochBullD : NaN);
      put(9, showD && isSplitSource && cfg.showBull ? stochBullD : NaN);
      put(10, showD && isSplitSource && cfg.showBear ? stochBearD : NaN);
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SourceAlignedOscillatorsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SourceAlignedOscillatorsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SourceAlignedOscillators = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
