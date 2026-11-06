/**
 * RSI-EMA-Crossing with Donchian-Stop-Loss
 *
 * Donchian channel (highest high, lowest low and their midpoint over `lenDonchian` bars) and a moving average of the
 * close. A signal candle is a bar where the RSI crosses over its moving average while the close is above the price
 * moving average: its high is stored and the background is yellow. The entry is the first later close above that
 * high (green label below the bar). The stop-loss line is the lower Donchian band.
 *
 * Reference: "RSI-EMA-Crossing with Donchian-Stop-Loss" by Kahael
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Kahael
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'HMA';

export interface RsiEmaCrossingWithDonchianStopLossInputs {
  /** Donchian channel length */
  lenDonchian: number;
  /** RSI length */
  lenRSI: number;
  /** Length of the moving average of the RSI */
  lenSMARSI: number;
  /** Moving average type of the RSI */
  maTypeRSI: MaType;
  /** Length of the price moving average */
  lenMAPrice: number;
  /** Moving average type of the price */
  maTypePrice: MaType;
}

export const defaultInputs: RsiEmaCrossingWithDonchianStopLossInputs = {
  lenDonchian: 48,
  lenRSI: 7,
  lenSMARSI: 14,
  maTypeRSI: 'SMA',
  lenMAPrice: 50,
  maTypePrice: 'SMA',
};

const MA_OPTIONS = ['SMA', 'EMA', 'WMA', 'VWMA', 'HMA'];

export const inputConfig: InputConfig[] = [
  { id: 'lenDonchian', type: 'int', title: 'Donchian Kanal Länge', defval: 48 },
  { id: 'lenRSI', type: 'int', title: 'RSI Länge', defval: 7 },
  { id: 'lenSMARSI', type: 'int', title: 'SMA RSI Länge', defval: 14 },
  { id: 'maTypeRSI', type: 'string', title: 'RSI MA-Typ', defval: 'SMA', options: MA_OPTIONS },
  { id: 'lenMAPrice', type: 'int', title: 'Preis MA Länge', defval: 50 },
  { id: 'maTypePrice', type: 'string', title: 'Preis MA-Typ', defval: 'SMA', options: MA_OPTIONS },
];

const STOP_COL = String(color.new(color.red, 60));
const SIGNAL_BG = String(color.new(color.yellow, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Donchian Upper', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Donchian Lower', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Donchian Basis', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Preis MA', color: color.orange, lineWidth: 1 },
  { id: 'plot4', title: 'Stop-Loss', color: STOP_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI-EMA-Crossing with Donchian-Stop-Loss',
  shortTitle: 'RSI-EMA-Crossing with Donchian-Stop-Loss',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

/** switch maType: only the selected branch runs (the input is constant, so on every bar) */
function maStep(len: number, type: MaType): Ma {
  switch (type) {
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'VWMA': return new WindowVwma(len);
    case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    default: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  }
}

interface RsiEmaVars {
  /** var float signalHigh = na */
  signalHigh: number;
  /** var bool isSignalActive = false */
  isSignalActive: boolean;
}

interface RsiEmaRun extends BarRunState<RsiEmaVars> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiMa: Ma;
  priceMa: Ma;
  cross: ReturnType<typeof taStep.crossover>;
  plots: { time: number; value: number; color: string }[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RsiEmaCrossingWithDonchianStopLossInputs>): BarStudy<RsiEmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: RsiEmaRun = {
        upper: new WindowExtreme(false, cfg.lenDonchian), lower: new WindowExtreme(true, cfg.lenDonchian),
        rsi: taStep.rsi(cfg.lenRSI), rsiMa: maStep(cfg.lenSMARSI, cfg.maTypeRSI), priceMa: maStep(cfg.lenMAPrice, cfg.maTypePrice),
        cross: taStep.crossover(), plots: [[], [], [], [], []], markers: [], bgColors: [],
        steps: [], vars: { signalHigh: NaN, isSignalActive: false }, lists: [], series: [],
      };
      s.steps = [s.upper, s.lower, s.rsi, s.rsiMa, s.priceMa, s.cross];
      s.lists = [s.markers, s.bgColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const volume = b.volume ?? NaN;
      const upperBand = s.upper.step(b.high);
      const lowerBand = s.lower.step(b.low);
      const basisBand = (upperBand + lowerBand) / 2;

      const rsiValue = s.rsi.step(b.close);
      const smaRSI = s.rsiMa.step(rsiValue, volume);
      const priceMA = s.priceMa.step(b.close, volume);
      // ta.crossover(rsiValue, smaRSI): exact comparisons (oakscriptjs)
      const cross = s.cross.step(rsiValue, smaRSI);

      const crossUp = cross && gt(b.close, priceMA);
      if (crossUp) {
        v.signalHigh = b.high;
        v.isSignalActive = true;
      }
      const entryCondition = v.isSignalActive && gt(b.close, v.signalHigh);
      if (entryCondition) v.isSignalActive = false;
      // bgcolor(crossUp ? color.new(color.yellow, 80) : na, title = "Signalkerze")
      if (crossUp) s.bgColors.push({ time: b.time, color: SIGNAL_BG });
      // plotshape(entryCondition, style = shape.labelup, location = location.belowbar, color = color.green, title = "Einstieg")
      if (entryCondition) s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green });

      const t = b.time;
      s.plots[0][i] = { time: t, value: upperBand, color: color.blue };
      s.plots[1][i] = { time: t, value: lowerBand, color: color.red };
      s.plots[2][i] = { time: t, value: basisBand, color: color.green };
      s.plots[3][i] = { time: t, value: priceMA, color: color.orange };
      // stopLoss = lowerBand
      s.plots[4][i] = { time: t, value: lowerBand, color: STOP_COL };
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiEmaCrossingWithDonchianStopLossInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiEmaCrossingWithDonchianStopLossInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiEmaCrossingWithDonchianStopLoss = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
