/**
 * ADX Trend Strength Filter + TRAMA [DotGain]
 *
 * TRAMA (trend regularity adaptive moving average): the smoothing factor is the square of the SMA over `tramaLength`
 * of a flag that is 1 when the highest high of `tramaLength` bars rises or the lowest low falls. A signal state is
 * kept: bullish when the close is above TRAMA, the EMA of a short RSI is above its SMA and a hand-made ADX is above
 * the threshold; bearish for the opposite; neutral when the close is between TRAMA and the SMA of the close. The bars
 * are green (bullish), red (bearish) or orange (neutral). TRAMA and the SMA are drawn with a fill between them.
 *
 * Reference: "ADX Trend Strength Filter + TRAMA [DotGain]" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ DotGain
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface AdxTrendStrengthFilterTramaInputs {
  tramaLength: number;
  tramaSrc: SourceType;
  rsiLength: number;
  rsiSmaLength: number;
  rsiEmaLength: number;
  adxLength: number;
  adxThreshold: number;
  showSma: boolean;
  smaLength: number;
}

export const defaultInputs: AdxTrendStrengthFilterTramaInputs = {
  tramaLength: 99,
  tramaSrc: 'close',
  rsiLength: 7,
  rsiSmaLength: 50,
  rsiEmaLength: 35,
  adxLength: 14,
  adxThreshold: 30,
  showSma: true,
  smaLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'tramaLength', type: 'int', title: 'TRAMA Length', defval: 99 },
  { id: 'tramaSrc', type: 'source', title: 'TRAMA Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 7 },
  { id: 'rsiSmaLength', type: 'int', title: 'RSI SMA Length', defval: 50 },
  { id: 'rsiEmaLength', type: 'int', title: 'RSI EMA Length', defval: 35 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 30 },
  { id: 'showSma', type: 'bool', title: 'Show SMA', defval: true },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 200 },
];

const TRAMA_COL = String(color.new(color.orange, 33));
const SMA_COL = color.white;
const FILL_COL = String(color.new(color.orange, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRAMA', color: TRAMA_COL, lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: SMA_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'ADX Trend Strength Filter + TRAMA [DotGain]',
  shortTitle: 'ADX TSF',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine x != 0: false for na */
const ne0 = (a: number) => !isNaN(a) && Math.abs(a) > EPS;
/** Pine math.min / math.max: na when an argument is na */
const pmin = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const pmax = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface TramaVars {
  /** var int signalState = 0 */
  signalState: number;
}

interface TramaRun extends BarRunState<TramaVars> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  tc: WindowSma;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiSma: WindowSma;
  rsiEma: ReturnType<typeof taStep.ema>;
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  sma: WindowSma;
  hhArr: number[];
  llArr: number[];
  ama: number[];
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<AdxTrendStrengthFilterTramaInputs>): BarStudy<TramaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.tramaSrc);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.tramaSrc) ? null : 'source of another study'),
    init() {
      const s: TramaRun = {
        hh: new WindowExtreme(false, cfg.tramaLength), ll: new WindowExtreme(true, cfg.tramaLength),
        tc: new WindowSma(cfg.tramaLength), rsi: taStep.rsi(cfg.rsiLength), rsiSma: new WindowSma(cfg.rsiSmaLength),
        rsiEma: taStep.ema(cfg.rsiEmaLength), tr: taStep.tr(true), trur: taStep.rma(cfg.adxLength),
        plusRma: taStep.rma(cfg.adxLength), minusRma: taStep.rma(cfg.adxLength), adx: taStep.rma(cfg.adxLength),
        sma: new WindowSma(cfg.smaLength), hhArr: [], llArr: [], ama: [], plot0: [], plot1: [], barColors: [],
        steps: [], vars: { signalState: 0 }, lists: [], series: [],
      };
      s.steps = [s.hh, s.ll, s.tc, s.rsi, s.rsiSma, s.rsiEma, s.tr, s.trur, s.plusRma, s.minusRma, s.adx, s.sma];
      s.series = [s.hhArr, s.llArr, s.ama, s.plot0, s.plot1, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;

      // TRAMA
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      s.hhArr[i] = hh;
      s.llArr[i] = ll;
      const hhChange = i > 0 ? hh - s.hhArr[i - 1] : NaN;
      const llChange = i > 0 ? ll - s.llArr[i - 1] : NaN;
      const hhf = pmax(Math.sign(hhChange), 0);
      const llf = pmax(Math.sign(-llChange), 0);
      const flag = ne0(hhf) || ne0(llf) ? 1.0 : 0.0;
      const tcSma = s.tc.step(flag);
      const src = value(b);
      const prev = i > 0 ? s.ama[i - 1] : NaN;
      // ama := nz(ama[1] + tc * (tramaSrc - ama[1]), tramaSrc)
      const v = prev + Math.pow(tcSma, 2) * (src - prev);
      const ama = Number.isFinite(v) ? v : src;
      s.ama[i] = ama;

      // RSI and its moving averages
      const rsi = s.rsi.step(c);
      const rsiSma = s.rsiSma.step(rsi);
      const rsiEma = s.rsiEma.step(rsi);

      // Hand-made ADX
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? bars[i - 1].low - b.low : NaN;
      const plusDM = gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = gt(down, up) && gt(down, 0) ? down : 0;
      const trur = s.trur.step(s.tr.step(b.high, b.low, c));
      const plusRma = s.plusRma.step(plusDM);
      const minusRma = s.minusRma.step(minusDM);
      const plusDI = (100 * plusRma) / trur;
      const minusDI = (100 * minusRma) / trur;
      const dx = (100 * Math.abs(plusDI - minusDI)) / (plusDI + minusDI);
      const adx = s.adx.step(dx);
      const sma = s.sma.step(c);

      let signalState = s.vars.signalState;
      const adxCondition = gt(adx, cfg.adxThreshold);
      const priceBetween = gt(c, pmin(ama, sma)) && lt(c, pmax(ama, sma));
      const bull = gt(c, ama) && gt(rsiEma, rsiSma) && adxCondition;
      const bear = lt(c, ama) && lt(rsiEma, rsiSma) && adxCondition;
      if (priceBetween) signalState = 0;
      else if (signalState === 1) {
        if (bull) signalState = 1;
        else if (bear) signalState = -1;
      } else if (signalState === -1) {
        if (bear) signalState = -1;
        else if (bull) signalState = 1;
      } else if (bull) signalState = 1;
      else if (bear) signalState = -1;
      s.vars.signalState = signalState;
      s.barColors[i] = { time: b.time, color: signalState === 1 ? color.green : signalState === -1 ? color.red : color.orange };
      s.plot0[i] = { time: b.time, value: fin(ama), color: TRAMA_COL };
      s.plot1[i] = { time: b.time, value: cfg.showSma ? fin(sma) : NaN, color: SMA_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(plotTrama, plotSma, color = color.new(color.orange, 80))
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: FILL_COL } }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxTrendStrengthFilterTramaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxTrendStrengthFilterTramaInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxTrendStrengthFilterTrama = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
