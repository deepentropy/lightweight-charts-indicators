/**
 * Aggressive Volume
 *
 * Estimated aggressive volume of each bar: the volume times the body / range ratio (|close - open| / (high - low),
 * a range of 0 counts as 0.0001), signed by the bar direction (+1 for close > open, -1 for close < open, 0 for a
 * doji). Columns show the volume (grey), the buy part (estimate >= 0, green) and the sell part (estimate < 0, as a
 * positive value, red). A moving average (SMA, EMA, WMA, VWMA, SMMA = SMA, or HMA) of the buy part is drawn as a line.
 *
 * Reference: "Aggressive Volume" by oDouglasAlex
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AggressiveVolumeInputs {
  /** Moving average length */
  periodoMedia: number;
  /** Moving average type (SMMA is computed as an SMA, as in the original script) */
  tipoMedia: 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HMA';
  /** Show the moving average */
  mostrarMedia: boolean;
}

export const defaultInputs: AggressiveVolumeInputs = {
  periodoMedia: 14,
  tipoMedia: 'SMA',
  mostrarMedia: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'periodoMedia', type: 'int', title: 'Período da Média Móvel', defval: 14, min: 1 },
  { id: 'tipoMedia', type: 'string', title: 'Tipo de Média Móvel', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'HMA'] },
  { id: 'mostrarMedia', type: 'bool', title: 'Mostrar Média Móvel?', defval: true },
];

const COMMON = String(color.new(color.gray, 70));
const BUY = String(color.new(color.green, 0));
const SELL = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Comum', color: COMMON, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume de Compra (Agressão)', color: BUY, lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Volume de Venda (Agressão)', color: SELL, lineWidth: 2, style: 'columns' },
  { id: 'plot3', title: 'Média Móvel do Volume de Agressão', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Aggressive Volume',
  shortTitle: 'Aggressive Volume',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface AggRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<AggressiveVolumeInputs>): BarStudy<AggRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.periodoMedia;
  const P = (time: number, v: number, c: string): Point => ({ time, value: Number.isFinite(v) ? v : NaN, color: c });
  // mediaDeltaEstimado(): the moving average of the buy part, chosen by type (a constant input: one branch runs on
  // every bar)
  const maStep = (): Ma => {
    switch (cfg.tipoMedia) {
      case 'SMA':
      case 'SMMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const hma = cfg.tipoMedia !== 'SMA' && cfg.tipoMedia !== 'SMMA' && cfg.tipoMedia !== 'EMA' && cfg.tipoMedia !== 'WMA' && cfg.tipoMedia !== 'VWMA';
  return {
    init() {
      const ma = maStep();
      const s: AggRun = { ma, plot0: [], plot1: [], plot2: [], plot3: [], steps: [ma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
      if (hma && i === 0 && Math.floor(len / 2) < 1) {
        throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      const b = bars[i];
      const time = b.time as number;
      const vol = b.volume ?? NaN;
      const corpo = Math.abs(b.close - b.open);
      let amplitude = b.high - b.low;
      // amplitude := amplitude == 0 ? 0.0001 : amplitude
      amplitude = eq(amplitude, 0) ? 0.0001 : amplitude;
      const proporcao = corpo / amplitude;
      const direcao = gt(b.close, b.open) ? 1 : lt(b.close, b.open) ? -1 : 0;
      const delta = direcao * vol * proporcao;
      // deltaEstimadoPositivo = deltaEstimado >= 0 ? deltaEstimado : na; deltaEstimadoNegativo = deltaEstimado < 0 ? -deltaEstimado : na
      const pos = ge(delta, 0) ? delta : NaN;
      const neg = lt(delta, 0) ? -delta : NaN;
      const media = s.ma.step(pos, vol);
      s.plot0[i] = P(time, vol, COMMON);
      s.plot1[i] = P(time, pos, BUY);
      s.plot2[i] = P(time, neg, SELL);
      s.plot3[i] = P(time, cfg.mostrarMedia ? media : NaN, color.orange);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AggressiveVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AggressiveVolumeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AggressiveVolume = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
