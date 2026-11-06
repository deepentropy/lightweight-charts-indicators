/**
 * T1 Wyckoff Aggressive A/D Setup
 *
 * Wyckoff climax and automatic-reaction candles. A wide-range candle has a range above 1.3 times its SMA; volume
 * spikes above its SMA; the slope is the change of the linear regression of the close (offset 0 against offset 1).
 * Selling climax: a new 10-bar low, a volume spike, a close near the low, a wide range, a long lower wick and a
 * falling slope (buying climax: the mirror with a rising slope). Bullish AR: a wide range, a close near the high, a
 * volume spike and a falling slope (bearish AR: the mirror). SOS / SOW: a wide range, a close near the high / low, a
 * volume spike and a close that breaks the highest / lowest close of the lookback. "Reversal" mode: a Long label on a
 * bullish AR within the structure lookback of a selling climax (Short: bearish AR after a buying climax).
 * "Trend Following" mode: an SOS within 1.5 times the lookback of a selling climax and within the lookback of a
 * bullish AR (Short: SOW, buying climax, bearish AR). The background is green on a rising slope and red on a falling
 * slope.
 *
 * Reference: "[Teyo69] T1 Wyckoff Aggressive A/D Setup" by Teyo69
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Teyo69
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface T1WyckoffAggressiveADSetupInputs {
  volLen: number;
  signalOption: 'Reversal' | 'Trend Following';
  slopeLen: number;
  rangeLen: number;
  wickThresh: number;
  closeThresh: number;
  breakoutLookback: number;
  structureLookback: number;
}

export const defaultInputs: T1WyckoffAggressiveADSetupInputs = {
  volLen: 20,
  signalOption: 'Reversal',
  slopeLen: 10,
  rangeLen: 20,
  wickThresh: 0.4,
  closeThresh: 0.3,
  breakoutLookback: 20,
  structureLookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'volLen', type: 'int', title: 'Volume MA Length', defval: 20 },
  { id: 'signalOption', type: 'string', title: 'Signal Options', defval: 'Reversal', options: ['Reversal', 'Trend Following'] },
  { id: 'slopeLen', type: 'int', title: 'Linear Reg Slope Length', defval: 10 },
  { id: 'rangeLen', type: 'int', title: 'Candle Range MA Length', defval: 20 },
  { id: 'wickThresh', type: 'float', title: 'Wick % of Candle', defval: 0.4 },
  { id: 'closeThresh', type: 'float', title: 'Close Near Low Threshold (0-1)', defval: 0.3 },
  { id: 'breakoutLookback', type: 'int', title: 'Breakout Lookback High', defval: 20 },
  { id: 'structureLookback', type: 'int', title: 'Structure Threshold Lookback', defval: 10 },
];

// Markers and background colours only (plotshape, bgcolor)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: '[Teyo69] T1 Wyckoff Aggressive A/D Setup',
  shortTitle: '[Teyo69] T1 Wyckoff Aggressive A/D Setup',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * `ta.linreg(source, length, 0)` and `ta.linreg(source, length, 1)` of one source, one bar at a time: the least
 * squares sums of the oakscriptjs array function (x = 1 oldest .. length newest, summed from the oldest value) taken
 * once for both offsets (the same doubles); na while fewer than `length` bars or when a value of the window is na.
 */
class LinregPair implements Committable {
  private readonly len: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  /** The offset 1 value of the last step */
  offset1 = NaN;

  constructor(length: number) {
    // the length checks of ta.linreg (the same errors)
    taStep.linreg(length, 0);
    this.len = Math.floor(length);
  }

  /** The offset 0 value of the current bar (the offset 1 value in `offset1`) */
  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.offset1 = NaN;
    const len = this.len;
    const values = this.values;
    const base = values.length - (len - 1);
    if (base < 0) return NaN;
    for (let j = 0; j < len - 1; j++) if (isNaN(values[base + j])) return NaN;
    if (isNaN(value)) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = j === len - 1 ? value : values[base + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    this.offset1 = intercept + slope * (len - 1 - 1);
    return intercept + slope * (len - 1 - 0);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

const prev = (a: number[], i: number) => (i > 0 ? a[i - 1] : NaN);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface WyckoffRun extends BarRunState<Record<string, never>> {
  volSma: ReturnType<typeof taStep.sma>;
  rangeSma: ReturnType<typeof taStep.sma>;
  lin: LinregPair;
  lo10: WindowExtreme;
  hi10: WindowExtreme;
  hiClose: WindowExtreme;
  loClose: WindowExtreme;
  sinceSc: ReturnType<typeof taStep.barssince>;
  sinceBullAr: ReturnType<typeof taStep.barssince>;
  sinceBc: ReturnType<typeof taStep.barssince>;
  sinceBearAr: ReturnType<typeof taStep.barssince>;
  lowest10: number[];
  highest10: number[];
  highestClose: number[];
  lowestClose: number[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<T1WyckoffAggressiveADSetupInputs>): BarStudy<WyckoffRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const trend = cfg.signalOption === 'Trend Following';
  const reversal = cfg.signalOption === 'Reversal';
  const sbp1Mult = trend ? cfg.structureLookback * 1.5 : cfg.structureLookback * 1;
  const bgRising = String(color.new(color.green, 85));
  const bgFalling = String(color.new(color.red, 85));
  return {
    init() {
      const s: WyckoffRun = {
        volSma: taStep.sma(), rangeSma: taStep.sma(),
        lin: new LinregPair(cfg.slopeLen),
        lo10: new WindowExtreme(true, 10), hi10: new WindowExtreme(false, 10),
        hiClose: new WindowExtreme(false, cfg.breakoutLookback), loClose: new WindowExtreme(true, cfg.breakoutLookback),
        sinceSc: taStep.barssince(), sinceBullAr: taStep.barssince(), sinceBc: taStep.barssince(),
        sinceBearAr: taStep.barssince(),
        lowest10: [], highest10: [], highestClose: [], lowestClose: [], markers: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.volSma, s.rangeSma, s.lin, s.lo10, s.hi10, s.hiClose, s.loClose, s.sinceSc, s.sinceBullAr,
        s.sinceBc, s.sinceBearAr,
      ];
      s.lists = [s.markers, s.bgColors];
      s.series = [s.lowest10, s.highest10, s.highestClose, s.lowestClose];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const vol = b.volume === undefined || b.volume === null ? NaN : b.volume;
      const candleRange = b.high - b.low;
      const volSMA = s.volSma.step(vol, cfg.volLen);
      const rangeSMA = s.rangeSma.step(candleRange, cfg.rangeLen);
      // ta.linreg(close, slopeLen, 0) and ta.linreg(close, slopeLen, 1)
      const lin0 = s.lin.step(b.close);
      const lin1 = s.lin.offset1;
      s.lowest10[i] = s.lo10.step(b.low);
      s.highest10[i] = s.hi10.step(b.high);
      s.highestClose[i] = s.hiClose.step(b.close);
      s.lowestClose[i] = s.loClose.step(b.close);

      const fallingSlope = lt(lin0, lin1);
      const risingSlope = gt(lin0, lin1);
      const volSpike = gt(vol, volSMA);
      const makesNewLow = lt(b.low, prev(s.lowest10, i));
      const makesNewHigh = gt(b.high, prev(s.highest10, i));
      // Plain divisions: a zero range gives 0 / 0 = na (false)
      const closeNearLow = lt((b.close - b.low) / candleRange, cfg.closeThresh);
      const closeNearHigh = lt((b.high - b.close) / candleRange, cfg.closeThresh);
      const hasLowerWick = gt(b.open - b.low, candleRange * cfg.wickThresh);
      const hasUpperWick = gt(b.high - b.open, candleRange * cfg.wickThresh);
      const isWideRange = gt(candleRange, rangeSMA * 1.3);
      const breaksStructure = gt(b.close, prev(s.highestClose, i));
      const breaksStructureLow = lt(b.close, prev(s.lowestClose, i));
      const sellingClimax = makesNewLow && volSpike && closeNearLow && isWideRange && hasLowerWick && fallingSlope;
      const buyingClimax = makesNewHigh && volSpike && closeNearHigh && isWideRange && hasUpperWick && risingSlope;
      const bullishAr = isWideRange && closeNearHigh && volSpike && fallingSlope;
      const bearishAr = isWideRange && closeNearLow && volSpike && risingSlope;
      const sos = isWideRange && closeNearHigh && volSpike && breaksStructure;
      const sow = isWideRange && closeNearLow && volSpike && breaksStructureLow;

      const bullP1 = le(s.sinceSc.step(sellingClimax ? 1 : 0), sbp1Mult);
      const bullP2 = le(s.sinceBullAr.step(bullishAr ? 1 : 0), cfg.structureLookback);
      const bearP1 = le(s.sinceBc.step(buyingClimax ? 1 : 0), sbp1Mult);
      const bearP2 = le(s.sinceBearAr.step(bearishAr ? 1 : 0), cfg.structureLookback);
      const agWsBull = reversal ? bullP1 && bullishAr : trend ? bullP1 && bullP2 && sos : false;
      const agWsBear = reversal ? bearP1 && bearishAr : trend ? bearP1 && bearP2 && sow : false;

      // Two bgcolor calls (layers): rising slope green, falling slope red
      if (risingSlope) s.bgColors.push({ time: t, color: bgRising });
      if (fallingSlope) s.bgColors.push({ time: t, color: bgFalling });
      // Both plotshape calls use location.belowbar and shape.labelup
      if (agWsBull) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Long',
          textColor: color.white, id: 'shape0' });
      }
      if (agWsBear) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.red, text: 'Short',
          textColor: color.white, id: 'shape1' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<T1WyckoffAggressiveADSetupInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<T1WyckoffAggressiveADSetupInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const T1WyckoffAggressiveADSetup = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
