/**
 * Uptrick: Liquid Reversal Bands
 *
 * Fair value = EMA(smoothness / 2) of 0.55 * EMA(fair length) + 0.45 * ALMA(fair length, 0.85, 6) of the source.
 * Band width = EMA(smoothness) of 0.60 * stdev(source - fair, lookback) + 0.25 * ATR(14)
 * + 0.10 * EMA(lookback) of |source - fair| + 0.05 * EMA(smoothness) of the bar range. Upper / lower bands are
 * fair +/- width * multiplier, the optional outer bands a further multiple. The fair value line is coloured on a
 * bear-to-bull scale by its smoothed normalised slope. A close back above the lower band gives a buy label, a close
 * back below the upper band a sell label (with an optional cooldown). Candles are redrawn with the position of the
 * source in the bands (bull colour at the lower band, bear colour at the upper band) or with the last signal colour.
 * Gradient fills from the bands to the fair value.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' / 'Sell Signal', true on the bars of the buy / sell
 * labels.
 *
 * Reference: "Uptrick: Liquid Reversal Bands" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LiquidReversalBandsInputs {
  /** Source */
  src: SourceType;
  /** Fair value length (EMA and ALMA) */
  fairLen: number;
  /** Lookback of the deviation stdev and EMA */
  zLen: number;
  /** Band smoothness (EMA length of the width and the range; fair value EMA of half of it) */
  smoothLen: number;
  upperMult: number;
  lowerMult: number;
  outerUpperMult: number;
  outerLowerMult: number;
  /** Show the buy / sell signals */
  enableSignals: boolean;
  /** Minimum bars between two signals */
  cooldownBars: number;
  /** Candle colouring mode */
  candleMode: 'Reversal Heat' | 'Latest Signal';
  showOuterBands: boolean;
  /** EMA length of the fair value slope */
  lineSlopeLen: number;
  /** Slope colour sensitivity */
  lineSlopeSensitivity: number;
}

export const defaultInputs: LiquidReversalBandsInputs = {
  src: 'close',
  fairLen: 50,
  zLen: 100,
  smoothLen: 18,
  upperMult: 2.4,
  lowerMult: 2.4,
  outerUpperMult: 1.45,
  outerLowerMult: 1.45,
  enableSignals: true,
  cooldownBars: 0,
  candleMode: 'Reversal Heat',
  showOuterBands: false,
  lineSlopeLen: 5,
  lineSlopeSensitivity: 1.25,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fairLen', type: 'int', title: 'Fair Value Length', defval: 50, min: 1 },
  { id: 'zLen', type: 'int', title: 'Z-Width Lookback', defval: 100, min: 10 },
  { id: 'smoothLen', type: 'int', title: 'Band Smoothness', defval: 18, min: 1 },
  { id: 'upperMult', type: 'float', title: 'Upper Band Multiplier', defval: 2.4, step: 0.1 },
  { id: 'lowerMult', type: 'float', title: 'Lower Band Multiplier', defval: 2.4, step: 0.1 },
  { id: 'outerUpperMult', type: 'float', title: 'Outer Upper Band Multiplier', defval: 1.45, step: 0.05 },
  { id: 'outerLowerMult', type: 'float', title: 'Outer Lower Band Multiplier', defval: 1.45, step: 0.05 },
  { id: 'enableSignals', type: 'bool', title: 'Show Signals', defval: true },
  { id: 'cooldownBars', type: 'int', title: 'Signal Cooldown', defval: 0, min: 0 },
  { id: 'candleMode', type: 'string', title: 'Candle Coloring Mode', defval: 'Reversal Heat', options: ['Reversal Heat', 'Latest Signal'] },
  { id: 'showOuterBands', type: 'bool', title: 'Show Outer Bands', defval: false },
  { id: 'lineSlopeLen', type: 'int', title: 'Slope Smoothing Length', defval: 5, min: 1 },
  { id: 'lineSlopeSensitivity', type: 'float', title: 'Slope Color Sensitivity', defval: 1.25, step: 0.05 },
];

const BULL_MAIN = String(color.new('#5CF0D7', 0));
const BEAR_MAIN = String(color.new('#B32AC3', 0));
const LABEL_TEXT_COL = color.white;
const BORDER_COL = String(color.new(color.white, 50));
const EMPTY_COL = String(color.new('#000104', 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BORDER_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BORDER_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Fair Value', color: BULL_MAIN, lineWidth: 1 },
  { id: 'plot3', title: 'Outer Upper Band', color: String(color.new(BORDER_COL, 80)), lineWidth: 1 },
  { id: 'plot4', title: 'Outer Lower Band', color: String(color.new(BORDER_COL, 80)), lineWidth: 1 },
];

export const metadata = {
  title: 'Uptrick: Liquid Reversal Bands',
  shortTitle: 'LRB',
  overlay: true,
};

// Pine compares floats with a tolerance of 1e-10; a comparison with na is false, `na != 0` too.
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** f_clamp(x, min, max) = math.max(min, math.min(x, max)) (na stays na) */
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(x, hi));

/** f_colorGradient(ratio, colA, colB): channel a + int((b - a) * ratio), color.rgb(r, g, b, 0) */
function colorGradient(ratio: number, colA: string, colB: string): string {
  const ch = (k: 'r' | 'g' | 'b') => {
    const a = color[k](colA);
    const b = color[k](colB);
    return a + Math.trunc((b - a) * ratio);
  };
  return String(color.rgb(ch('r'), ch('g'), ch('b'), 0));
}

type Point = { time: number; value: number; color?: string };
type LrbResult = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

/** ta.alma(source, length, offset, sigma) weights (the oakscriptjs array function: normalised gaussian weights) */
function almaWeights(length: number, offset: number, sigma: number): number[] {
  const m = offset * (length - 1);
  const s = length / sigma;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(weight);
    weightSum += weight;
  }
  for (let i = 0; i < length; i++) weights[i] /= weightSum;
  return weights;
}

interface LrbVars {
  /** var int lastSignalBar, var string lastSignal */
  lastSignalBar: number;
  lastSignal: string;
}

interface LrbRun extends BarRunState<LrbVars> {
  emaFair: ReturnType<typeof taStep.ema>;
  fairEma: ReturnType<typeof taStep.ema>;
  devStdev: ReturnType<typeof taStep.stdev>;
  atr: ReturnType<typeof taStep.atr>;
  absDev: ReturnType<typeof taStep.ema>;
  rangeEnergy: ReturnType<typeof taStep.ema>;
  width: ReturnType<typeof taStep.ema>;
  slopeAvg: ReturnType<typeof taStep.ema>;
  slopeSmooth: ReturnType<typeof taStep.ema>;
  src: number[];
  fair: number[];
  upperBand: number[];
  lowerBand: number[];
  outerUpperBand: number[];
  outerLowerBand: number[];
  upperPlot: Point[];
  lowerPlot: Point[];
  fairPlot: Point[];
  outerUpperPlot: Point[];
  outerLowerPlot: Point[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LiquidReversalBandsInputs>): BarStudy<LrbRun, LrbResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { fairLen, zLen, smoothLen, upperMult, lowerMult, outerUpperMult, outerLowerMult, cooldownBars,
    showOuterBands, lineSlopeLen, lineSlopeSensitivity } = cfg;
  const value = barSource(cfg.src);
  const outerCol = String(color.new(BORDER_COL, 80));
  let weights: number[] = [];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // Liquid fair value
      const emaFair = taStep.ema(fairLen);
      checkAlmaLength(fairLen);
      weights = almaWeights(fairLen, 0.85, 6.0);
      const fairEma = taStep.ema(Math.max(1, Math.trunc(smoothLen / 2)));
      // Liquid band width
      const devStdev = taStep.stdev();
      const atr = taStep.atr(14);
      const absDev = taStep.ema(zLen);
      const rangeEnergy = taStep.ema(smoothLen);
      const width = taStep.ema(smoothLen);
      const slopeAvg = taStep.ema(lineSlopeLen);
      const slopeSmooth = taStep.ema(lineSlopeLen);
      const s: LrbRun = {
        emaFair, fairEma, devStdev, atr, absDev, rangeEnergy, width, slopeAvg, slopeSmooth,
        src: [], fair: [], upperBand: [], lowerBand: [], outerUpperBand: [], outerLowerBand: [],
        upperPlot: [], lowerPlot: [], fairPlot: [], outerUpperPlot: [], outerLowerPlot: [], candles: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [emaFair, fairEma, devStdev, atr, absDev, rangeEnergy, width, slopeAvg, slopeSmooth],
        vars: { lastSignalBar: NaN, lastSignal: '' },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.src, s.fair, s.upperBand, s.lowerBand, s.outerUpperBand, s.outerLowerBand, s.upperPlot, s.lowerPlot,
        s.fairPlot, s.outerUpperPlot, s.outerLowerPlot, s.candles, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      s.src[i] = src;

      // Liquid fair value: ta.alma(src, fairLen, 0.85, 6) from the source of the last fairLen bars
      const emaFair = s.emaFair.step(src);
      let almaFair = NaN;
      if (!(i < fairLen - 1)) {
        almaFair = 0;
        for (let j = 0; j < fairLen; j++) almaFair += s.src[i - fairLen + 1 + j] * weights[j];
      }
      const fairRaw = emaFair * 0.55 + almaFair * 0.45;
      const fair = s.fairEma.step(fairRaw);
      s.fair[i] = fair;

      // Liquid band width
      const dev = src - fair;
      const devStdev = s.devStdev.step(dev, zLen);
      const atrValue = s.atr.step(b.high, b.low, b.close);
      const absDev = s.absDev.step(Math.abs(dev));
      const rangeEnergy = s.rangeEnergy.step(b.high - b.low);
      const baseWidth = devStdev * 0.60 + atrValue * 0.25 + absDev * 0.10 + rangeEnergy * 0.05;
      const width = s.width.step(baseWidth);

      const upperBand = fair + width * upperMult;
      const lowerBand = fair - width * lowerMult;
      const outerUpperBand = fair + width * upperMult * outerUpperMult;
      const outerLowerBand = fair - width * lowerMult * outerLowerMult;
      s.upperBand[i] = upperBand;
      s.lowerBand[i] = lowerBand;
      s.outerUpperBand[i] = outerUpperBand;
      s.outerLowerBand[i] = outerLowerBand;

      // Smooth fair value line colour
      // fairSlopeRaw = nz(fair - fair[1], 0.0)
      const d = fair - (i > 0 ? s.fair[i - 1] : NaN);
      const fairSlopeRaw = isNaN(d) ? 0 : d;
      const fairSlopeAvg = s.slopeAvg.step(Math.abs(fairSlopeRaw));
      // fairSlopeNorm = fairSlopeAvg != 0.0 ? fairSlopeRaw / fairSlopeAvg : 0.0
      const fairSlopeNorm = ne(fairSlopeAvg, 0) ? fairSlopeRaw / fairSlopeAvg : 0;
      const fairSlopeSmooth = s.slopeSmooth.step(fairSlopeNorm);

      // lineRatio = f_clamp(0.5 + fairSlopeSmooth / (2.0 * lineSlopeSensitivity), 0.0, 1.0)
      // (sensitivity 0: a non-zero value / 0 is +-infinity, clamped to 1 / 0 as in Pine; 0 / 0 is na)
      const lineRatio = clamp(0.5 + fairSlopeSmooth / (2.0 * lineSlopeSensitivity), 0.0, 1.0);
      s.fairPlot[i] = { time: t, value: fair, color: colorGradient(lineRatio, BEAR_MAIN, BULL_MAIN) };

      // rawBuy = close[1] <= lowerBand[1] and close > lowerBand; rawSell = close[1] >= upperBand[1] and close < upperBand
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const rawBuy = i > 0 && le(close1, s.lowerBand[i - 1]) && gt(b.close, lowerBand);
      const rawSell = i > 0 && ge(close1, s.upperBand[i - 1]) && gt(upperBand, b.close);
      // barsOk = na(lastSignalBar) or bar_index - lastSignalBar >= cooldownBars
      const v = s.vars;
      const barsOk = isNaN(v.lastSignalBar) || i - v.lastSignalBar >= cooldownBars;
      const finalBuy = cfg.enableSignals && rawBuy && barsOk;
      const finalSell = cfg.enableSignals && rawSell && barsOk;
      if (finalBuy) {
        v.lastSignalBar = i;
        v.lastSignal = 'bull';
      }
      if (finalSell) {
        v.lastSignalBar = i;
        v.lastSignal = 'bear';
      }

      // bandRange = upperBand - lowerBand; ratioRaw = bandRange != 0.0 ? (src - lowerBand) / bandRange : 0.5
      const bandRange = upperBand - lowerBand;
      const ratioRaw = ne(bandRange, 0) ? (src - lowerBand) / bandRange : 0.5;
      const ratioClamped = clamp(isNaN(ratioRaw) ? 0.5 : ratioRaw, 0.0, 1.0);
      const reversalCandleCol = colorGradient(ratioClamped, BULL_MAIN, BEAR_MAIN);
      const latestSignalCol = v.lastSignal === 'bull' ? BULL_MAIN : v.lastSignal === 'bear' ? BEAR_MAIN : reversalCandleCol;
      const candleCol = cfg.candleMode === 'Reversal Heat' ? reversalCandleCol : latestSignalCol;
      // plotcandle(open, high, low, close, 'Liquid Reversal Candles', color / wickcolor / bordercolor = candleCol)
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close,
        color: candleCol, wickColor: candleCol, borderColor: candleCol };

      // plotshape(finalBuy, 'Buy', location.belowbar, shape.labelup, text '𝓤𝓹', color bullMain, textcolor #000000, size.small)
      if (finalBuy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: BULL_MAIN, text: '𝓤𝓹',
          textColor: '#000000', size: 'small' });
      }
      // plotshape(finalSell, 'Sell', location.abovebar, shape.labeldown, text '𝓓𝓸𝔀𝓷', color bearMain, textcolor white, size.small)
      if (finalSell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: BEAR_MAIN, text: '𝓓𝓸𝔀𝓷',
          textColor: LABEL_TEXT_COL, size: 'small' });
      }

      s.upperPlot[i] = { time: t, value: upperBand, color: BORDER_COL };
      s.lowerPlot[i] = { time: t, value: lowerBand, color: BORDER_COL };
      // plot(showOuterBands ? outerUpperBand : na, ...); plot(showOuterBands ? outerLowerBand : na, ...)
      s.outerUpperPlot[i] = { time: t, value: showOuterBands ? outerUpperBand : NaN, color: outerCol };
      s.outerLowerPlot[i] = { time: t, value: showOuterBands ? outerLowerBand : NaN, color: outerCol };
      // alertcondition(finalBuy, "Buy Signal") / alertcondition(finalSell, "Sell Signal")
      s.flags[0][i] = finalBuy;
      s.flags[1][i] = finalSell;
      if (finalBuy) s.times[0].push(t as number);
      if (finalSell) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const constant = (c: string | null) => new Array<string | null>(n).fill(c);
      const upperBand = s.upperBand.slice();
      const lowerBand = s.lowerBand.slice();
      const fair = s.fair.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.upperPlot.slice(),
          plot1: s.lowerPlot.slice(),
          plot2: s.fairPlot.slice(),
          plot3: s.outerUpperPlot.slice(),
          plot4: s.outerLowerPlot.slice(),
        },
        fills: [
          // fill(pUpper, pFair, upperBand, fair, color.new(bearMain, 80), emptyCol)
          { plot1: 'plot0', plot2: 'plot2', gradient: { topValue: upperBand, bottomValue: fair,
            topColor: constant(String(color.new(BEAR_MAIN, 80))), bottomColor: constant(EMPTY_COL) } },
          // fill(pFair, pLower, fair, lowerBand, emptyCol, color.new(bullMain, 80))
          { plot1: 'plot2', plot2: 'plot1', gradient: { topValue: fair, bottomValue: lowerBand,
            topColor: constant(EMPTY_COL), bottomColor: constant(String(color.new(BULL_MAIN, 80))) } },
          // fill(pOuterUpper, pUpper, outerUpperBand, upperBand, showOuterBands ? color.new(bearMain, 70) : na,
          //      showOuterBands ? color.new(bearMain, 100) : na)
          { plot1: 'plot3', plot2: 'plot0', gradient: { topValue: s.outerUpperBand.slice(), bottomValue: upperBand,
            topColor: constant(showOuterBands ? String(color.new(BEAR_MAIN, 70)) : null),
            bottomColor: constant(showOuterBands ? String(color.new(BEAR_MAIN, 100)) : null) } },
          // fill(pLower, pOuterLower, lowerBand, outerLowerBand, showOuterBands ? color.new(bullMain, 100) : na,
          //      showOuterBands ? color.new(bullMain, 70) : na)
          { plot1: 'plot1', plot2: 'plot4', gradient: { topValue: lowerBand, bottomValue: s.outerLowerBand.slice(),
            topColor: constant(showOuterBands ? String(color.new(BULL_MAIN, 100)) : null),
            bottomColor: constant(showOuterBands ? String(color.new(BULL_MAIN, 70)) : null) } },
        ],
        markers: s.markers.slice(),
        plotCandles: { liquidReversalCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** ta.alma: a length below 1 is a runtime error */
function checkAlmaLength(length: number): void {
  const len = Math.trunc(length);
  if (len <= 0) throw new Error(`Invalid value of the 'length' argument (${len}) in the 'alma' function. It must be > 0.`);
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidReversalBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<LrbResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidReversalBandsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Uptrick LRB: Close crossed above lower band' },
  { id: 'alert1', title: 'Sell Signal', message: 'Uptrick LRB: Close crossed below upper band' },
];

export const LiquidReversalBands = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
