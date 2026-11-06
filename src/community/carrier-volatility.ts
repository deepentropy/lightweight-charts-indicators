/**
 * Carrier Volatility [Pumori]
 *
 * An RSI (default), its SMA, the close or a custom source is smoothed twice by an exponential average with a
 * fractional length (default 0.1, alpha = 2 / (length + 1) above 1): sum = alpha * x + (1 - alpha) * nz(sum[1]).
 * The second average ("EMA") is drawn with a copy shifted one bar to the left ("EMA offset") and a fill between
 * them, with the input series. The set is drawn in the indicator pane, or on the price pane when "Show on Main
 * Chart?" is on.
 *
 * Reference: "Pumori" by et20tradeview
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © et20tradeview
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type CarrierVolatilityMode = 'Defaut (RSI)' | 'Diagnostic (RSI SMA)' | 'Price' | 'Custom';

export interface CarrierVolatilityInputs {
  /** Draw the lines on the price pane (else in the indicator pane) */
  showOnPrice: boolean;
  /** Input series */
  mode: CarrierVolatilityMode;
  /** Source of the Custom mode */
  source: SourceType;
  /** Length of the first average */
  factor: number;
  /** Length of the second average */
  factor2: number;
  rsiLength: number;
  maLength: number;
}

export const defaultInputs: CarrierVolatilityInputs = {
  showOnPrice: false,
  mode: 'Defaut (RSI)',
  source: 'close',
  factor: 0.1,
  factor2: 0.1,
  rsiLength: 14,
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'showOnPrice', type: 'bool', title: 'Show on Main Chart?', defval: false },
  { id: 'mode', type: 'string', title: 'Input Mode', defval: 'Defaut (RSI)', options: ['Defaut (RSI)', 'Diagnostic (RSI SMA)', 'Price', 'Custom'] },
  { id: 'source', type: 'source', title: 'Custom Mode', defval: 'close' },
  { id: 'factor', type: 'float', title: 'factor', defval: 0.1, min: 0.1, step: 0.1 },
  { id: 'factor2', type: 'float', title: 'factor2', defval: 0.1, min: 0.1, step: 0.1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14 },
];

const SOURCE_COLOR = String(color.new(color.rgb(255, 235, 59), 75));

export const plotConfig: PlotConfig[] = [
  // display = showOnPrice ? display.none : display.all (result.visibility.showInPane)
  { id: 'plot0', title: 'EMA', color: color.purple, lineWidth: 1, visible: 'showInPane' },
  { id: 'plot1', title: 'EMA offset', color: color.purple, lineWidth: 1, visible: 'showInPane' },
  { id: 'plot2', title: 'source', color: SOURCE_COLOR, lineWidth: 1, visible: 'showInPane' },
  // force_overlay = true, display = showOnPrice ? display.all : display.none
  { id: 'plot3', title: 'EMA', color: color.purple, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
  { id: 'plot4', title: 'EMA offset', color: color.purple, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
  { id: 'plot5', title: 'source', color: SOURCE_COLOR, lineWidth: 1, forceOverlay: true, visible: 'showOnPrice' },
];

export const metadata = {
  title: 'Pumori',
  shortTitle: 'Pumori',
  overlay: false,
};

type Result = IndicatorResult & { visibility: Record<string, boolean> };
type Point = { time: number; value: number; color: string };

interface CarrierRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsiMa: WindowSma;
  ln1: number[];
  ln2: number[];
  line: Point[];
  shifted: Point[];
  source: Point[];
}

function study(inputs: Partial<CarrierVolatilityInputs>): BarStudy<CarrierRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const custom = barSource(cfg.source);
  // pine_ema(src, length): sum = alpha * src + (1 - alpha) * nz(sum[1]), alpha = 2 / (length + 1)
  const alpha1 = 2 / (cfg.factor + 1);
  const alpha2 = 2 / (cfg.factor2 + 1);
  return {
    fullRunReason: () => (cfg.mode !== 'Custom' || isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      // rsi_input = ta.rsi(close, rsiLengthInput); rsi_ma = ta.sma(rsi_input, maLengthInput)
      const rsi = taStep.rsi(cfg.rsiLength);
      const rsiMa = new WindowSma(cfg.maLength);
      const s: CarrierRun = {
        rsi, rsiMa, ln1: [], ln2: [], line: [], shifted: [], source: [],
        steps: [rsi, rsiMa], vars: {}, lists: [], series: [],
      };
      s.series = [s.ln1, s.ln2, s.line, s.source];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const rsi = s.rsi.step(b.close);
      const rsiMa = s.rsiMa.step(rsi);
      const seriesP = cfg.mode === 'Defaut (RSI)' ? rsi
        : cfg.mode === 'Diagnostic (RSI SMA)' ? rsiMa
          : cfg.mode === 'Price' ? b.close
            : custom(b);
      const p1 = i > 0 && !isNaN(s.ln1[i - 1]!) ? s.ln1[i - 1]! : 0;
      const ln1 = alpha1 * seriesP + (1 - alpha1) * p1;
      const p2 = i > 0 && !isNaN(s.ln2[i - 1]!) ? s.ln2[i - 1]! : 0;
      const ln2 = alpha2 * ln1 + (1 - alpha2) * p2;
      s.ln1[i] = ln1;
      s.ln2[i] = ln2;
      const time = b.time as number;
      s.line[i] = { time, value: ln2, color: color.purple };
      s.source[i] = { time, value: seriesP, color: SOURCE_COLOR };
      // plot(ln2, "EMA offset", offset = -1): the value of bar i is drawn on bar i - 1 (only written by bar i)
      if (i > 0) s.shifted[i - 1] = { time: bars[i - 1]!.time as number, value: ln2, color: color.purple };
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = s.shifted.slice(0, Math.max(0, n - 1));
      // fill(p2, p3, color.new(#69359C, 70), "Lag Shading", display = showOnPrice ? none : all); fill(p4, p5, ...)
      const shade = String(color.new('#69359C', 70));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.line.slice(),
          plot1: shifted,
          plot2: s.source.slice(),
          plot3: s.line.slice(),
          plot4: shifted.slice(),
          plot5: s.source.slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Lag Shading' },
            colors: new Array<string>(n).fill(cfg.showOnPrice ? 'transparent' : shade) },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Lag Shading' },
            colors: new Array<string>(n).fill(cfg.showOnPrice ? shade : 'transparent') },
        ],
        visibility: { showInPane: !cfg.showOnPrice, showOnPrice: cfg.showOnPrice },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CarrierVolatilityInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CarrierVolatilityInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CarrierVolatility = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
