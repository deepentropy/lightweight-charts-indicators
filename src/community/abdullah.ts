/**
 * 3-in-1 Combined Indicator (published as "Abdullah")
 *
 * Three indicators in one overlay:
 * 1. ZLSMA: lsma = linreg(src, length, offset), zlsma = 2 * lsma - linreg(lsma, length, offset).
 * 2. Chandelier Exit: long stop = highest(close or high, length) - mult * ATR, kept from falling while the
 *    previous close stays above it; short stop = lowest(close or low, length) + mult * ATR, kept from rising while
 *    the previous close stays below it. The direction turns long when the close goes above the previous short stop,
 *    short when it goes below the previous long stop; Buy / Sell labels at the turns and a state fill to ohlc4.
 * 3. EMA of the source, with an optional smoothing moving average (SMA, EMA, RMA, WMA, VWMA) of the EMA and
 *    optional Bollinger Bands around the SMA.
 *
 * Reference: "3-in-1 Combined Indicator v6" by royalsherry888
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AbdullahMaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface AbdullahInputs {
  /** ZLSMA length */
  zlsmaLength: number;
  /** ZLSMA linreg offset */
  zlsmaOffset: number;
  zlsmaSrc: SourceType;
  /** Chandelier Exit ATR period */
  ceLength: number;
  /** Chandelier Exit ATR multiplier */
  ceMult: number;
  /** Use the close for the extremums (else high / low) */
  ceUseClose: boolean;
  ceShowLabels: boolean;
  ceHighlightState: boolean;
  emaLength: number;
  emaSrc: SourceType;
  /** Plot offset of the EMA (bars) */
  emaOffset: number;
  /** Smoothing moving average type of the EMA */
  maType: AbdullahMaType;
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: AbdullahInputs = {
  zlsmaLength: 32,
  zlsmaOffset: 0,
  zlsmaSrc: 'close',
  ceLength: 22,
  ceMult: 3.0,
  ceUseClose: true,
  ceShowLabels: true,
  ceHighlightState: true,
  emaLength: 9,
  emaSrc: 'close',
  emaOffset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

const ZLSMA_GROUP = '1. ZLSMA - Zero Lag LSMA';
const CE_CALC_GROUP = '2. Chandelier Exit - Calculation';
const CE_VISUAL_GROUP = '2. Chandelier Exit - Visuals';
const EMA_GROUP = '3. EMA';
const EMA_SMOOTH_GROUP = '3. EMA - Smoothing';

export const inputConfig: InputConfig[] = [
  { id: 'zlsmaLength', type: 'int', title: 'Length', defval: 32, group: ZLSMA_GROUP },
  { id: 'zlsmaOffset', type: 'int', title: 'Offset', defval: 0, group: ZLSMA_GROUP },
  { id: 'zlsmaSrc', type: 'source', title: 'Source', defval: 'close', group: ZLSMA_GROUP },
  { id: 'ceLength', type: 'int', title: 'ATR Period', defval: 22, group: CE_CALC_GROUP },
  { id: 'ceMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, step: 0.1, group: CE_CALC_GROUP },
  { id: 'ceUseClose', type: 'bool', title: 'Use Close Price for Extremums', defval: true, group: CE_CALC_GROUP },
  { id: 'ceShowLabels', type: 'bool', title: 'Show Buy/Sell Labels', defval: true, group: CE_VISUAL_GROUP },
  { id: 'ceHighlightState', type: 'bool', title: 'Highlight State', defval: true, group: CE_VISUAL_GROUP },
  { id: 'emaLength', type: 'int', title: 'Length', defval: 9, min: 1, group: EMA_GROUP },
  { id: 'emaSrc', type: 'source', title: 'Source', defval: 'close', group: EMA_GROUP },
  { id: 'emaOffset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, group: EMA_GROUP },
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', group: EMA_SMOOTH_GROUP,
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: EMA_SMOOTH_GROUP },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: EMA_SMOOTH_GROUP,
    tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands." },
];

const LONG_FILL = String(color.new(color.green, 85));
const SHORT_FILL = String(color.new(color.red, 85));
const BB_FILL = String(color.new(color.green, 90));

// display = enableMA / isBB ? display.all : display.none: PlotConfig `visible` = result.visibility entry
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLSMA', color: color.yellow, lineWidth: 3 },
  { id: 'plot1', title: 'Long Stop', color: color.green, lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Short Stop', color: color.red, lineWidth: 2, style: 'linebr' },
  { id: 'plot3', title: 'CE Mid Price', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot5', title: 'EMA-based MA', color: color.yellow, lineWidth: 1, visible: 'enableMA' },
  { id: 'plot6', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  { id: 'plot7', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot1', color: LONG_FILL, title: 'Long State Filling' },
  { id: 'fill1', plot1: 'plot3', plot2: 'plot2', color: SHORT_FILL, title: 'Short State Filling' },
  { id: 'fill2', plot1: 'plot6', plot2: 'plot7', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'isBB' },
];

export const metadata = {
  title: '3-in-1 Combined Indicator v6',
  shortTitle: '3-in-1 v6',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; visibility: Record<string, boolean> };

interface AbdullahVars {
  /** var int ce_dir = 1 */
  ceDir: number;
}

interface AbdullahRun extends BarRunState<AbdullahVars> {
  lsma: ReturnType<typeof taStep.linreg>;
  lsma2: ReturnType<typeof taStep.linreg>;
  atr: ReturnType<typeof taStep.atr>;
  hi: ReturnType<typeof taStep.highest>;
  lo: ReturnType<typeof taStep.lowest>;
  ema: ReturnType<typeof taStep.ema>;
  ma: { step(v: number, volume: number): number; commit(): void } | null;
  dev: ReturnType<typeof taStep.stdev> | null;
  longStop: number[];
  shortStop: number[];
  dir: number[];
  emaOut: number[];
  zlsmaPlot: Point[];
  longPlot: Point[];
  shortPlot: Point[];
  midPlot: Point[];
  maPlot: Point[];
  upperPlot: Point[];
  lowerPlot: Point[];
  longFill: string[];
  shortFill: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<AbdullahInputs>): BarStudy<AbdullahRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const zlsmaSrc = barSource(cfg.zlsmaSrc);
  const emaSrc = barSource(cfg.emaSrc);
  const ohlc4 = barSource('ohlc4');
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  const enableMA = cfg.maType !== 'None';
  const maStep = (): AbdullahRun['ma'] => {
    switch (cfg.maType) {
      case 'SMA':
      case 'SMA + Bollinger Bands': { const m = taStep.sma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(cfg.maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: return null;
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.zlsmaSrc) && isBarSource(cfg.emaSrc) ? null : 'source of another study'),
    init() {
      const lsma = taStep.linreg(cfg.zlsmaLength, cfg.zlsmaOffset);
      const lsma2 = taStep.linreg(cfg.zlsmaLength, cfg.zlsmaOffset);
      const atr = taStep.atr(cfg.ceLength);
      const hi = taStep.highest();
      const lo = taStep.lowest();
      const ema = taStep.ema(cfg.emaLength);
      const ma = maStep();
      const dev = isBB ? taStep.stdev() : null;
      const s: AbdullahRun = {
        lsma, lsma2, atr, hi, lo, ema, ma, dev,
        longStop: [], shortStop: [], dir: [], emaOut: [],
        zlsmaPlot: [], longPlot: [], shortPlot: [], midPlot: [], maPlot: [], upperPlot: [], lowerPlot: [],
        longFill: [], shortFill: [], markers: [],
        steps: [lsma, lsma2, atr, hi, lo, ema, ...(ma ? [ma] : []), ...(dev ? [dev] : [])],
        vars: { ceDir: 1 },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [
        s.longStop, s.shortStop, s.dir, s.emaOut, s.zlsmaPlot, s.longPlot, s.shortPlot, s.midPlot, s.maPlot,
        s.upperPlot, s.lowerPlot, s.longFill, s.shortFill,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // 1. ZLSMA
      const lsma = s.lsma.step(zlsmaSrc(b));
      const lsma2 = s.lsma2.step(lsma);
      s.zlsmaPlot[i] = { time, value: lsma + (lsma - lsma2), color: color.yellow };

      // 2. Chandelier Exit
      const ceAtr = cfg.ceMult * s.atr.step(b.high, b.low, b.close);
      const hi = s.hi.step(cfg.ceUseClose ? b.close : b.high, cfg.ceLength);
      const lo = s.lo.step(cfg.ceUseClose ? b.close : b.low, cfg.ceLength);
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      let ls = hi - ceAtr;
      // longStopPrev = nz(longStop[1], longStop)
      const lsPrev = i > 0 && !isNaN(s.longStop[i - 1]) ? s.longStop[i - 1] : ls;
      ls = gt(prevClose, lsPrev) ? Math.max(ls, lsPrev) : ls;
      let ss = lo + ceAtr;
      const ssPrev = i > 0 && !isNaN(s.shortStop[i - 1]) ? s.shortStop[i - 1] : ss;
      ss = lt(prevClose, ssPrev) ? Math.min(ss, ssPrev) : ss;
      s.longStop[i] = ls;
      s.shortStop[i] = ss;
      const c = b.close;
      const v = s.vars;
      v.ceDir = gt(c, ssPrev) ? 1 : lt(c, lsPrev) ? -1 : v.ceDir;
      const ceDir = v.ceDir;
      s.dir[i] = ceDir;
      // ce_dir[1] is na on bar 0: no signal
      const buySignal = i > 0 && ceDir === 1 && s.dir[i - 1] === -1;
      const sellSignal = i > 0 && ceDir === -1 && s.dir[i - 1] === 1;
      // plotshape(buySignal ? longStop : na, 'Long Stop Start', location.absolute, shape.circle, size.tiny, green)
      if (buySignal && !isNaN(ls)) {
        s.markers.push({ time, position: 'atPriceMiddle', price: ls, shape: 'circle', color: color.green, size: 'tiny', id: 'shape0' });
      }
      // plotshape(buySignal and ce_showLabels ? longStop : na, 'Buy Label', text = 'Buy', shape.labelup, size.tiny)
      if (buySignal && cfg.ceShowLabels && !isNaN(ls)) {
        s.markers.push({ time, position: 'atPriceBottom', price: ls, shape: 'labelUp', color: color.green,
          text: 'Buy', textColor: color.white, size: 'tiny', id: 'shape1' });
      }
      if (sellSignal && !isNaN(ss)) {
        // plotshape(sellSignal ? shortStop : na, 'Short Stop Start', ...) / 'Sell Label'
        s.markers.push({ time, position: 'atPriceMiddle', price: ss, shape: 'circle', color: color.red, size: 'tiny', id: 'shape2' });
      }
      if (sellSignal && cfg.ceShowLabels && !isNaN(ss)) {
        s.markers.push({ time, position: 'atPriceTop', price: ss, shape: 'labelDown', color: color.red,
          text: 'Sell', textColor: color.white, size: 'tiny', id: 'shape3' });
      }
      s.longPlot[i] = { time, value: ceDir === 1 ? ls : NaN, color: color.green };
      s.shortPlot[i] = { time, value: ceDir === 1 ? NaN : ss, color: color.red };
      s.midPlot[i] = { time, value: ohlc4(b) };
      // fill(midPricePlot, longStopPlot, color = ce_highlightState and ce_dir == 1 ? longFill : na)
      s.longFill[i] = cfg.ceHighlightState && ceDir === 1 ? LONG_FILL : 'transparent';
      s.shortFill[i] = cfg.ceHighlightState && ceDir === -1 ? SHORT_FILL : 'transparent';

      // 3. EMA and its smoothing
      const emaOut = s.ema.step(emaSrc(b));
      s.emaOut[i] = emaOut;
      const ma = s.ma ? s.ma.step(emaOut, b.volume ?? NaN) : NaN;
      const sd = s.dev ? s.dev.step(emaOut, cfg.maLength) * cfg.bbMult : NaN;
      s.maPlot[i] = { time, value: ma, color: color.yellow };
      s.upperPlot[i] = { time, value: ma + sd, color: color.green };
      s.lowerPlot[i] = { time, value: ma - sd, color: color.green };
    },
    result(s, bars) {
      const n = bars.length;
      // plot(ema_out, offset = ema_offset): the value of bar i is drawn on bar i + offset
      const interval = barInterval(bars);
      const emaPlot: Point[] = [];
      for (let i = 0; i < n; i++) {
        const j = i + cfg.emaOffset;
        if (j < 0) continue;
        emaPlot.push({ time: barTime(bars, j, interval), value: s.emaOut[i], color: color.blue });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.zlsmaPlot.slice(),
          plot1: s.longPlot.slice(),
          plot2: s.shortPlot.slice(),
          plot3: s.midPlot.slice(),
          plot4: emaPlot,
          plot5: s.maPlot.slice(),
          plot6: s.upperPlot.slice(),
          plot7: s.lowerPlot.slice(),
        },
        fills: [
          { plot1: 'plot3', plot2: 'plot1', options: { title: 'Long State Filling' }, colors: s.longFill.slice() },
          { plot1: 'plot3', plot2: 'plot2', options: { title: 'Short State Filling' }, colors: s.shortFill.slice() },
          // fill(bbUpperBand, bbLowerBand, color = isBB ? color.new(color.green, 90) : na)
          { plot1: 'plot6', plot2: 'plot7', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(isBB ? BB_FILL : 'transparent') },
        ],
        markers: s.markers.slice(),
        visibility: { enableMA, isBB },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AbdullahInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AbdullahInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; visibility: Record<string, boolean> } {
  return fullResult(createRun(inputs).update(bars));
}

export const Abdullah = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
