/**
 * Trendshift
 *
 * Keeps the last confirmed swing high and swing low (pivots with `swingLen` bars on each side). A bullish structure
 * shift is a close above the last swing high (by at least `atrMultBreak` ATR with the ATR filter) while a swing low
 * exists; a bearish shift is a close below the last swing low (same filter) while a swing high exists; when both
 * happen on one bar the candle direction decides. A bullish shift sets the band from the last swing low to the bar
 * high, a bearish shift from the bar low to the last swing high. The regime goes neutral after `regimeTimeoutBars`
 * bars without a shift (the band is cleared unless it persists). With a valid band (high > low and at least
 * `minBandAtrMult` ATR tall) the background is tinted when the close is in the lower quarter (discount) or the upper
 * quarter (premium). Markers show the first bullish shift after a bearish one and the first bearish shift after a
 * bullish one.
 *
 * Reference: "Trendshift [CHE]" by chervolino
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © chervolino
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendshiftInputs {
  /** Bars left / right of the swing highs and lows */
  swingLen: number;
  /** Require the breakout to exceed the swing level by an ATR multiple */
  useAtrFilter: boolean;
  /** ATR length */
  atrLen: number;
  /** Breakout distance beyond the swing level, in ATR */
  atrMultBreak: number;
  /** Premium / discount band on */
  enableFramework: boolean;
  /** Keep the last band after a regime timeout */
  persistLastBand: boolean;
  /** Minimum band height, in ATR */
  minBandAtrMult: number;
  /** Bars after the last shift before the regime is neutral (0 = no timeout) */
  regimeTimeoutBars: number;
  /** Swap the premium and discount colours */
  invertColors: boolean;
  /** Background tint in the discount and premium zones */
  showZoneTint: boolean;
  /** Markers of the first shift of each direction */
  showStructureMarks: boolean;
}

export const defaultInputs: TrendshiftInputs = {
  swingLen: 5,
  useAtrFilter: true,
  atrLen: 14,
  atrMultBreak: 1.0,
  enableFramework: true,
  persistLastBand: true,
  minBandAtrMult: 0.5,
  regimeTimeoutBars: 500,
  invertColors: true,
  showZoneTint: true,
  showStructureMarks: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'swingLen', type: 'int', title: 'Swing length', defval: 5, min: 1 },
  { id: 'useAtrFilter', type: 'bool', title: 'Use ATR filter', defval: true },
  { id: 'atrLen', type: 'int', title: 'ATR length', defval: 14, min: 1 },
  { id: 'atrMultBreak', type: 'float', title: 'Break ATR mult', defval: 1.0, min: 0.0, step: 0.1 },
  { id: 'enableFramework', type: 'bool', title: 'Enable framework', defval: true },
  { id: 'persistLastBand', type: 'bool', title: 'Persist band on timeout', defval: true },
  { id: 'minBandAtrMult', type: 'float', title: 'Min band size ATR mult', defval: 0.5, min: 0.0, step: 0.1 },
  { id: 'regimeTimeoutBars', type: 'int', title: 'Regime timeout bars', defval: 500, min: 0 },
  { id: 'invertColors', type: 'bool', title: 'Invert colors', defval: true },
  { id: 'showZoneTint', type: 'bool', title: 'Show zone tint', defval: true },
  { id: 'showStructureMarks', type: 'bool', title: 'Show shift markers', defval: true },
];

// No plot(): the outputs are background colours and markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Trendshift [CHE]',
  shortTitle: 'TrShift',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when b - a <= 1e-10, == within 1e-10 (na false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface TrendshiftVars {
  lastSwingHigh: number;
  lastSwingLow: number;
  regime: number;
  bandLow: number;
  bandHigh: number;
  lastShiftBar: number;
  isLastShiftBullish: boolean;
}

interface TrendshiftRun extends BarRunState<TrendshiftVars> {
  ph: PivotStep;
  pl: PivotStep;
  atr: ReturnType<typeof taStep.atr>;
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<TrendshiftInputs>): BarStudy<TrendshiftRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Colours: color.new(color.new(c, 30), 85) is c with transparency 85
  const discountZone = cfg.invertColors ? String(color.new(color.red, 30)) : String(color.new(color.green, 30));
  const premiumZone = cfg.invertColors ? String(color.new(color.green, 30)) : String(color.new(color.red, 30));
  const discountBg = String(color.new(discountZone, 85));
  const premiumBg = String(color.new(premiumZone, 85));
  const bullColor = String(color.new(color.lime, 0));
  const bearColor = String(color.new(color.red, 0));
  return {
    init() {
      const ph = new PivotStep(cfg.swingLen, cfg.swingLen, true);
      const pl = new PivotStep(cfg.swingLen, cfg.swingLen, false);
      const atr = taStep.atr(cfg.atrLen);
      const s: TrendshiftRun = {
        ph, pl, atr, markers: [], bgColors: [],
        steps: [ph, pl, atr],
        vars: {
          lastSwingHigh: NaN, lastSwingLow: NaN, regime: 0, bandLow: NaN, bandHigh: NaN, lastShiftBar: NaN,
          isLastShiftBullish: false,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const pivotHigh = s.ph.step(i, b.high);
      const pivotLow = s.pl.step(i, b.low);
      const atrValue = s.atr.step(b.high, b.low, b.close);
      if (!isNaN(pivotHigh)) v.lastSwingHigh = pivotHigh;
      if (!isNaN(pivotLow)) v.lastSwingLow = pivotLow;

      // Structure shifts
      const hasMajorHigh = !isNaN(v.lastSwingHigh);
      const hasMajorLow = !isNaN(v.lastSwingLow);
      const bullBase = hasMajorHigh && gt(b.close, v.lastSwingHigh);
      const bearBase = hasMajorLow && lt(b.close, v.lastSwingLow);
      let bullBreak = bullBase;
      let bearBreak = bearBase;
      if (cfg.useAtrFilter && gt(atrValue, 0)) {
        bullBreak = bullBase && ge(b.close - v.lastSwingHigh, cfg.atrMultBreak * atrValue);
        bearBreak = bearBase && ge(v.lastSwingLow - b.close, cfg.atrMultBreak * atrValue);
      }
      let bullShift = bullBreak && hasMajorLow;
      let bearShift = bearBreak && hasMajorHigh;
      if (bullShift && bearShift) {
        bullShift = ge(b.close, b.open);
        bearShift = !bullShift;
      }
      const bullFirst = bullShift && (isNaN(v.lastShiftBar) || !v.isLastShiftBullish);
      const bearFirst = bearShift && (isNaN(v.lastShiftBar) || v.isLastShiftBullish);

      // Regime and band update
      if (bullShift) {
        v.regime = 1;
        v.bandLow = v.lastSwingLow;
        v.bandHigh = b.high;
        v.lastShiftBar = i;
        v.isLastShiftBullish = true;
      }
      if (bearShift) {
        v.regime = -1;
        v.bandLow = b.low;
        v.bandHigh = v.lastSwingHigh;
        v.lastShiftBar = i;
        v.isLastShiftBullish = false;
      }
      // Regime timeout (bar_index differences do not depend on the first bar)
      if (cfg.regimeTimeoutBars > 0 && v.regime !== 0 && !bullShift && !bearShift && !isNaN(v.lastShiftBar)
        && i - v.lastShiftBar > cfg.regimeTimeoutBars) {
        v.regime = 0;
        if (!cfg.persistLastBand) {
          v.bandLow = NaN;
          v.bandHigh = NaN;
        }
      }

      // Premium / discount band
      const bandLow = v.bandLow;
      const bandHigh = v.bandHigh;
      const baseValid = cfg.enableFramework && !isNaN(bandLow) && !isNaN(bandHigh) && gt(bandHigh, bandLow);
      const span = baseValid ? bandHigh - bandLow : NaN;
      const notTiny = (baseValid && gt(atrValue, 0) && gt(cfg.minBandAtrMult, 0) && ge(span, cfg.minBandAtrMult * atrValue))
        || (baseValid && (eq(cfg.minBandAtrMult, 0) || le(atrValue, 0)));
      const valid = baseValid && notTiny;
      const discountThreshold = valid ? bandLow + 0.25 * span : NaN;
      const premiumThreshold = valid ? bandLow + 0.75 * span : NaN;
      const inDiscount = valid && le(b.close, discountThreshold);
      const inPremium = valid && ge(b.close, premiumThreshold);

      const t = b.time;
      // bgcolor(discount_bg_color, "Discount zone tint"), then bgcolor(premium_bg_color, "Premium zone tint")
      if (cfg.showZoneTint && inDiscount) s.bgColors.push({ id: 'bgcolor0', time: t, color: discountBg });
      if (cfg.showZoneTint && inPremium) s.bgColors.push({ id: 'bgcolor1', time: t, color: premiumBg });
      // plotshape(... ? low : na, shape.triangleup, location.belowbar, size.small, text = "Shift↑", textcolor = color.white)
      if (cfg.showStructureMarks && bullFirst) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: bullColor, text: 'Shift↑', textColor: color.white, size: 'small' });
      }
      // plotshape(... ? high : na, shape.triangledown, location.abovebar, size.small, text = "Shift↓", textcolor = color.white)
      if (cfg.showStructureMarks && bearFirst) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: bearColor, text: 'Shift↓', textColor: color.white, size: 'small' });
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
export function createRun(inputs: Partial<TrendshiftInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendshiftInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Trendshift = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
