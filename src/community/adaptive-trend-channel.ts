/**
 * Adaptive Trend Channel
 *
 * The high, low and close are smoothed with a linear regression (value at the current bar). A two-state regime
 * follows them: in the bull state a support trail keeps the highest `envelopeBars` low of the regressed lows and the
 * state turns bear when the SMA of the regressed highs falls below it and the regressed close is below the previous
 * regressed low; the bear state is the mirror image. The mid channel starts at the window trough (bull) / peak (bear)
 * on a flip and then only rises (bull) / falls (bear). The active band is the mid channel -/+ factor * ATR(100) / 2,
 * with a gradient fill between the candle body midpoint and the band, and circles mark the flips.
 *
 * Reference: "Adaptive Trend Channel" by MarketStructureLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Adaptive Trend Channel, developed by MarketStructureLab.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptiveTrendChannelInputs {
  /** Bars of the linear regression of high / low / close */
  regressionBars: number;
  /** Window of the SMA and highest / lowest of the regressed series */
  envelopeBars: number;
  /** Half-channel width = factor * ATR(100) / 2 (drawing only) */
  atrStretch: number;
  /** Colour of the bull state */
  uptrendPaint: string;
  /** Colour of the bear state */
  downtrendPaint: string;
}

const BRAND_BULL = String(color.rgb(64, 217, 143));
const BRAND_BEAR = String(color.rgb(246, 113, 113));

export const defaultInputs: AdaptiveTrendChannelInputs = {
  regressionBars: 7,
  envelopeBars: 2,
  atrStretch: 2.0,
  uptrendPaint: BRAND_BULL,
  downtrendPaint: BRAND_BEAR,
};

export const inputConfig: InputConfig[] = [
  { id: 'regressionBars', type: 'int', title: 'Linear regression span', defval: 7, min: 1 },
  { id: 'envelopeBars', type: 'int', title: 'Envelope reaction length', defval: 2, min: 1 },
  { id: 'atrStretch', type: 'float', title: 'Half-channel ATR factor', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'uptrendPaint', type: 'color', title: 'Bull channel', defval: BRAND_BULL },
  { id: 'downtrendPaint', type: 'color', title: 'Bear channel', defval: BRAND_BEAR },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mid channel', color: String(color.new(BRAND_BULL, 90)), lineWidth: 2 },
  { id: 'plot1', title: 'Lower band', color: String(color.new(BRAND_BULL, 20)), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Upper band', color: String(color.new(BRAND_BEAR, 20)), lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Adaptive Trend Channel',
  shortTitle: 'Adaptive Trend Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AtcVars {
  regime: number;
  centerline: number;
  bullSupportTrail: number;
  bearResistanceTrail: number;
}

interface AtcRun extends BarRunState<AtcVars> {
  linHigh: ReturnType<typeof taStep.linreg>;
  linLow: ReturnType<typeof taStep.linreg>;
  linClose: ReturnType<typeof taStep.linreg>;
  upperSma: WindowSma;
  lowerSma: WindowSma;
  peak: WindowExtreme;
  trough: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  regLow: number[];
  regHigh: number[];
  regimeArr: number[];
  plots: Point[][];
  fillMid: number[];
  floor: number[];
  roof: number[];
  markers: MarkerData[];
}

function study(inputs: Partial<AdaptiveTrendChannelInputs>): BarStudy<AtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const volatilityLookback = 100;
  const bullMid = String(color.new(cfg.uptrendPaint, 90));
  const bearMid = String(color.new(cfg.downtrendPaint, 90));
  const bullBand = String(color.new(cfg.uptrendPaint, 20));
  const bearBand = String(color.new(cfg.downtrendPaint, 20));
  const bullFillStrong = String(color.new(cfg.uptrendPaint, 45));
  const bearFillStrong = String(color.new(cfg.downtrendPaint, 45));
  return {
    init() {
      // linreg(src, regressionBars, 0)
      const linHigh = taStep.linreg(cfg.regressionBars, 0);
      const linLow = taStep.linreg(cfg.regressionBars, 0);
      const linClose = taStep.linreg(cfg.regressionBars, 0);
      const upperSma = new WindowSma(cfg.envelopeBars);
      const lowerSma = new WindowSma(cfg.envelopeBars);
      const peak = new WindowExtreme(false, cfg.envelopeBars);
      const trough = new WindowExtreme(true, cfg.envelopeBars);
      const atr = taStep.atr(volatilityLookback);
      const s: AtcRun = {
        linHigh, linLow, linClose, upperSma, lowerSma, peak, trough, atr, regLow: [], regHigh: [], regimeArr: [],
        plots: [[], [], []], fillMid: [], floor: [], roof: [], markers: [],
        steps: [linHigh, linLow, linClose, upperSma, lowerSma, peak, trough, atr],
        vars: { regime: NaN, centerline: NaN, bullSupportTrail: NaN, bearResistanceTrail: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.regLow, s.regHigh, s.regimeArr, ...s.plots, s.fillMid, s.floor, s.roof];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const regHigh = s.linHigh.step(b.high);
      const regLow = s.linLow.step(b.low);
      const regClose = s.linClose.step(b.close);
      s.regHigh[i] = regHigh;
      s.regLow[i] = regLow;
      const upperReaction = s.upperSma.step(regHigh);
      const lowerReaction = s.lowerSma.step(regLow);
      const windowPeak = s.peak.step(regHigh);
      const windowTrough = s.trough.step(regLow);
      const atr = s.atr.step(b.high, b.low, b.close);

      // Regime: var regime = na, centerline = na, bullSupportTrail = low (bar 0), bearResistanceTrail = high (bar 0).
      // math.min / math.max give na when an argument is na.
      if (i === 0) {
        v.bullSupportTrail = b.low;
        v.bearResistanceTrail = b.high;
      }
      const historyReady = i > cfg.regressionBars;
      const regLowPrev = i > 0 ? s.regLow[i - 1] : NaN;
      const regHighPrev = i > 0 ? s.regHigh[i - 1] : NaN;
      if (isNaN(v.regime) && historyReady) {
        v.regime = 1;
        v.centerline = windowTrough;
        v.bullSupportTrail = regLow;
      } else if (v.regime === 1) {
        v.bullSupportTrail = Math.max(v.bullSupportTrail, windowTrough);
        if (lt(upperReaction, v.bullSupportTrail) && lt(regClose, regLowPrev)) {
          v.regime = -1;
          v.centerline = windowPeak;
          v.bearResistanceTrail = regHigh;
        }
      } else {
        v.bearResistanceTrail = Math.min(v.bearResistanceTrail, windowPeak);
        if (gt(lowerReaction, v.bearResistanceTrail) && gt(regClose, regHighPrev)) {
          v.regime = 1;
          v.centerline = windowTrough;
          v.bullSupportTrail = regLow;
        }
      }
      v.centerline = v.regime === 1 ? Math.max(v.centerline, windowTrough) : Math.min(v.centerline, windowPeak);
      const regime = v.regime;
      const center = v.centerline;
      s.regimeArr[i] = regime;

      const half = cfg.atrStretch * atr * 0.5;
      const roof = center + half;
      const floor = center - half;
      s.roof[i] = roof;
      s.floor[i] = floor;
      s.fillMid[i] = (b.open + b.close) * 0.5;

      const time = b.time;
      // tint = regime == 1 ? uptrendPaint : downtrendPaint (na regime: downtrendPaint)
      s.plots[0][i] = { time, value: center, color: regime === 1 ? bullMid : bearMid };
      s.plots[1][i] = { time, value: regime === 1 ? floor : NaN, color: bullBand };
      s.plots[2][i] = { time, value: regime === -1 ? roof : NaN, color: bearBand };

      // ta.crossover(regime, 0) / ta.crossunder(regime, 0): exact comparisons (no 1e-10 tolerance); na on the previous
      // bar gives false. plotshape(flipDown ? roof : na, "Bearish flip") is shape0, plotshape(flipUp ? floor : na,
      // "Bullish flip") shape1
      if (i === 0) return;
      const prev = s.regimeArr[i - 1];
      const flipUp = regime > 0 && prev <= 0;
      const flipDown = regime < 0 && prev >= 0;
      if (flipDown && !isNaN(roof)) {
        s.markers.push({ id: 'shape0', time, position: 'atPriceMiddle', price: roof, shape: 'circle',
          color: cfg.downtrendPaint, size: 'small' });
      }
      if (flipUp && !isNaN(floor)) {
        s.markers.push({ id: 'shape1', time, position: 'atPriceMiddle', price: floor, shape: 'circle',
          color: cfg.uptrendPaint, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills: [
          // fill(pMid, pFloor, fillMid, floor, color.new(uptrendPaint, 90), color.new(uptrendPaint, 45))
          { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: s.fillMid.slice(), bottomValue: s.floor.slice(),
            topColor: new Array(n).fill(bullMid), bottomColor: new Array(n).fill(bullFillStrong) } },
          // fill(pMid, pRoof, roof, fillMid, color.new(downtrendPaint, 45), color.new(downtrendPaint, 90))
          { plot1: 'plot0', plot2: 'plot2', gradient: { topValue: s.roof.slice(), bottomValue: s.fillMid.slice(),
            topColor: new Array(n).fill(bearFillStrong), bottomColor: new Array(n).fill(bearMid) } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveTrendChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveTrendChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveTrendChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
