/**
 * Q Wave
 *
 * Two adaptive EMA-like waves of hlc3. The smoothing factor of each wave is the EMA alpha of its length, raised by
 * the bar pressure: |close - open| / ATR, times the volume ratio volume / SMA(volume) (capped at 3, optional).
 * The structure direction is +1 when the latest structLen-bar high is more recent than the latest structLen-bar low,
 * -1 in the other case. A counter (capped at +-2 * inertia) moves with the structure direction and sets the
 * confirmed regime when it reaches +-inertia. The fast wave is coloured by the structure, the slow wave by the
 * regime, and the zone between them by their agreement.
 *
 * Reference: "Q Wave" by Quantora
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Quantora
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface QWaveInputs {
  /** Bars used to detect the dominant price structure */
  structLen: number;
  /** Fast wave sensitivity (EMA length) */
  fastLen: number;
  /** Slow wave sensitivity (EMA length) */
  slowLen: number;
  /** Regime inertia: counter value that confirms the regime */
  regimeInertia: number;
  /** ATR and volume average length */
  baseLen: number;
  /** Use volume weighting */
  useVol: boolean;
  bullColor: string;
  bearColor: string;
  neutralColor: string;
  /** Zone fill transparency */
  zoneTransp: number;
  /** Line width (the plot widths of the config stay at the default 2 / 1) */
  lineW: number;
}

export const defaultInputs: QWaveInputs = {
  structLen: 20,
  fastLen: 10,
  slowLen: 35,
  regimeInertia: 6,
  baseLen: 14,
  useVol: true,
  bullColor: '#00c8ff',
  bearColor: '#ff3060',
  neutralColor: '#b0bec5',
  zoneTransp: 86,
  lineW: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'structLen', type: 'int', title: 'Structure Period', defval: 20, min: 2 },
  { id: 'fastLen', type: 'int', title: 'Fast Wave Sensitivity', defval: 10, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Wave Sensitivity', defval: 35, min: 2 },
  { id: 'regimeInertia', type: 'int', title: 'Regime Inertia', defval: 6, min: 1 },
  { id: 'baseLen', type: 'int', title: 'ATR / Volume Length', defval: 14, min: 1 },
  { id: 'useVol', type: 'bool', title: 'Use Volume Weighting', defval: true },
  { id: 'bullColor', type: 'color', title: 'Bull', defval: '#00c8ff' },
  { id: 'bearColor', type: 'color', title: 'Bear', defval: '#ff3060' },
  { id: 'neutralColor', type: 'color', title: 'Transition', defval: '#b0bec5' },
  { id: 'zoneTransp', type: 'int', title: 'Zone Transparency', defval: 86, min: 50, max: 95 },
  { id: 'lineW', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast Wave', color: '#00c8ff', lineWidth: 2 },
  { id: 'plot1', title: 'Slow Wave', color: '#00c8ff', lineWidth: 1 },
];

export const metadata = {
  title: 'Q Wave',
  shortTitle: 'Q Wave',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface QWaveVars {
  lastHighBar: number;
  lastLowBar: number;
  wFast: number;
  wSlow: number;
  counter: number;
  slowDir: number;
}

interface QWaveRun extends BarRunState<QWaveVars> {
  hiExt: WindowExtreme;
  loExt: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  volSma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  zoneColors: string[];
}

function study(inputs: Partial<QWaveInputs>): BarStudy<QWaveRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { structLen, fastLen, slowLen, regimeInertia, baseLen, useVol } = cfg;
  const dirColor = (d: number) => (d === 1 ? cfg.bullColor : d === -1 ? cfg.bearColor : cfg.neutralColor);
  const neutTransp = Math.min(cfg.zoneTransp + 5, 100);
  const zoneBull = String(color.new(cfg.bullColor, cfg.zoneTransp));
  const zoneBear = String(color.new(cfg.bearColor, cfg.zoneTransp));
  const zoneNeut = String(color.new(cfg.neutralColor, neutTransp));
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // ta.highestbars(high, structLen) == 0 / ta.lowestbars(low, structLen) == 0: the bar's own value is the extreme
      // of the window (the newest of equal values wins); the length checks of highestbars / lowestbars first
      taCore.highestbars([], structLen);
      const hiExt = new WindowExtreme(false, structLen);
      taCore.lowestbars([], structLen);
      const loExt = new WindowExtreme(true, structLen);
      const atr = taStep.atr(baseLen);
      const volSma = new WindowSma(baseLen);
      const s: QWaveRun = {
        hiExt, loExt, atr, volSma, plot0: [], plot1: [], zoneColors: [],
        steps: [hiExt, loExt, atr, volSma],
        // var int lastHighBar = bar_index / lastLowBar = bar_index: equal on the first bar (only their order counts)
        vars: { lastHighBar: 0, lastLowBar: 0, wFast: NaN, wSlow: NaN, counter: 0, slowDir: 0 },
        lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.zoneColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      const hiMax = s.hiExt.step(b.high);
      const loMin = s.loExt.step(b.low);
      if (Number.isFinite(b.high) && hiMax === b.high) v.lastHighBar = i;
      if (Number.isFinite(b.low) && loMin === b.low) v.lastLowBar = i;
      const structDir = v.lastHighBar > v.lastLowBar ? 1 : v.lastHighBar < v.lastLowBar ? -1 : 0;

      const atrV = s.atr.step(b.high, b.low, b.close) ?? NaN;
      const volume = b.volume ?? NaN;
      const volSmaV = s.volSma.step(volume) ?? NaN;
      const atr = Number.isNaN(atrV) ? 0.0 : atrV;
      const volMA = Number.isNaN(volSmaV) ? 0.0 : volSmaV;
      const volRatio = useVol && gt(volMA, 0) ? Math.min(volume / volMA, 3.0) : 1.0;
      const pressure = gt(atr, 0) ? Math.abs((b.close - b.open) / atr) * volRatio : 1.0;

      const boost = 1.0 + Math.min(pressure * 0.15, 1.0);
      const alphaFast = Math.max(0.05, Math.min(0.60, (2.0 / (fastLen + 1)) * boost));
      const alphaSlow = Math.max(0.02, Math.min(0.30, (2.0 / (slowLen + 1)) * boost * 0.5));

      const hlc3 = (b.high + b.low + b.close) / 3;
      if (i === 0) {
        // var float wFast = hlc3 / wSlow = hlc3
        v.wFast = hlc3;
        v.wSlow = hlc3;
      }
      v.wFast = (1.0 - alphaFast) * v.wFast + alphaFast * hlc3;
      v.wSlow = (1.0 - alphaSlow) * v.wSlow + alphaSlow * hlc3;

      v.counter = structDir === 1 ? Math.min(v.counter + 1, regimeInertia * 2)
        : structDir === -1 ? Math.max(v.counter - 1, -regimeInertia * 2)
          : v.counter;
      v.slowDir = v.counter >= regimeInertia ? 1 : v.counter <= -regimeInertia ? -1 : v.slowDir;

      s.plot0[i] = { time: b.time, value: val(v.wFast), color: dirColor(structDir) };
      s.plot1[i] = { time: b.time, value: val(v.wSlow), color: dirColor(v.slowDir) };
      s.zoneColors[i] = structDir === 1 && v.slowDir === 1 ? zoneBull : structDir === -1 && v.slowDir === -1 ? zoneBear : zoneNeut;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Wave Zone' }, colors: s.zoneColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QWaveInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QWaveInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const QWave = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
