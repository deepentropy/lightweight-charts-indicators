/**
 * Pekipek's PPO Divergence BETA
 *
 * Percentage Price Oscillator smoothed with SMA, plus pivot-based divergence
 * detection including long-term divergences.
 *
 * PPO = ((EMA_fast - EMA_slow) / EMA_slow) * 100, then d = SMA(PPO, smoother).
 *
 * Display elements from Pine source:
 *  - plot(d)                      white line
 *  - plot(bulldiv) "Tops"         aqua circles at PPO bottoms (offset -1)
 *  - plot(beardiv) "Bottoms"      red circles at PPO tops (offset -1)
 *  - 8 divergence circle plots     orange (bearish) / purple (bullish): short term,
 *                                 delayed and long term, each its own plot as in the original
 *  - No markers and no level line: the original draws its signals as circle plots only
 *
 * Reference: "Pekipek's PPO Divergence BETA" by Pekipek
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PPODivergenceInputs {
  fastLength: number;
  slowLength: number;
  smoother: number;
  divLookbackPeriod: number;
  longTermDiv: boolean;
  src: SourceType;
}

export const defaultInputs: PPODivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  smoother: 2,
  divLookbackPeriod: 55,
  longTermDiv: true,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'smoother', type: 'int', title: 'Smoother', defval: 2, min: 1 },
  { id: 'divLookbackPeriod', type: 'int', title: 'Lookback Period', defval: 55, min: 1 },
  { id: 'longTermDiv', type: 'bool', title: 'Use Long Term Divergences?', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

// Plot order and titles of the original (11 plots; 8 divergence circle plots)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: '#FFFFFF', lineWidth: 1 },
  { id: 'plot1', title: 'Tops', color: '#00FFFF', lineWidth: 4, style: 'circles' },
  { id: 'plot2', title: 'Bottoms', color: '#FF0000', lineWidth: 4, style: 'circles' },
  { id: 'plot3', title: 'Bearish Divergence2', color: '#FF7F00', lineWidth: 4, style: 'circles' },
  { id: 'plot4', title: 'Bullish Divergence2', color: '#800080', lineWidth: 4, style: 'circles' },
  { id: 'plot5', title: 'Bullish Divergence2', color: '#800080', lineWidth: 4, style: 'circles' },
  { id: 'plot6', title: 'Bearish Divergence2', color: '#FF7F00', lineWidth: 4, style: 'circles' },
  { id: 'plot7', title: 'Bearish Divergence2', color: '#FF7F00', lineWidth: 4, style: 'circles' },
  { id: 'plot8', title: 'Bullish Divergence2', color: '#800080', lineWidth: 4, style: 'circles' },
  { id: 'plot9', title: 'Bearish Divergence2', color: '#FF7F00', lineWidth: 4, style: 'circles' },
  { id: 'plot10', title: 'Bullish Divergence2', color: '#800080', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'PPO Divergence',
  shortTitle: 'PPODiv',
  overlay: false,
};

// --- Pine-equivalent helpers ---

/** a > b / a < b with na: false. */
const gt = (a: number, b: number): boolean => a > b;
const lt = (a: number, b: number): boolean => a < b;

type Result = Omit<IndicatorResult, 'markers'>;
type Point = { time: number; value: number };
type Vw = ReturnType<typeof taStep.valuewhen>;

interface PpoVars {
  /** barssince(oscMins / oscMax / priceMins / priceMax) */
  bsOscMins: number;
  bsOscMax: number;
  bsPriceMins: number;
  bsPriceMax: number;
}

interface PpoRun extends BarRunState<PpoVars> {
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  dSma: ReturnType<typeof taStep.sma>;
  low6: ReturnType<typeof taStep.lowest>;
  high7: ReturnType<typeof taStep.highest>;
  lowestLow: ReturnType<typeof taStep.lowest>;
  highestHigh: ReturnType<typeof taStep.highest>;
  highestD: ReturnType<typeof taStep.highest>;
  lowestD: ReturnType<typeof taStep.lowest>;
  vw: Record<'ct4' | 'ct5' | 'ct6' | 'ct7' | 'y2' | 'y6' | 'bull' | 'bear' | 'y3' | 'y4' | 'y7' | 'y8' | 'y9' | 'y10', Vw>;
  d: number[];
  plot0: Point[];
  /** plot1 / plot2: bar i writes its own point (na) and the point of bar i - 1 (offset -1) */
  plot1: Point[];
  plot2: Point[];
  divPlots: Point[][];
}

function study(inputs: Partial<PPODivergenceInputs>): BarStudy<PpoRun, Result> {
  const { fastLength, slowLength, smoother, divLookbackPeriod, longTermDiv, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const vw = {
        ct4: taStep.valuewhen(0), ct5: taStep.valuewhen(0), ct6: taStep.valuewhen(0), ct7: taStep.valuewhen(0),
        y2: taStep.valuewhen(1), y6: taStep.valuewhen(1), bull: taStep.valuewhen(1), bear: taStep.valuewhen(1),
        y3: taStep.valuewhen(0), y4: taStep.valuewhen(1), y7: taStep.valuewhen(0), y8: taStep.valuewhen(1),
        y9: taStep.valuewhen(0), y10: taStep.valuewhen(0),
      };
      const s: PpoRun = {
        emaFast: taStep.ema(fastLength), emaSlow: taStep.ema(slowLength), dSma: taStep.sma(), low6: taStep.lowest(),
        high7: taStep.highest(), lowestLow: taStep.lowest(), highestHigh: taStep.highest(), highestD: taStep.highest(),
        lowestD: taStep.lowest(), vw, d: [], plot0: [], plot1: [], plot2: [], divPlots: Array.from({ length: 8 }, () => []),
        steps: [], vars: { bsOscMins: NaN, bsOscMax: NaN, bsPriceMins: NaN, bsPriceMax: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.emaFast, s.emaSlow, s.dSma, s.low6, s.high7, s.lowestLow, s.highestHigh, s.highestD, s.lowestD, ...Object.values(vw),
      ];
      s.series = [s.d, s.plot0, s.plot1, s.plot2, ...s.divPlots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const vw = s.vw;
      const source = value(b);
      const f = s.emaFast.step(source);
      const sl = s.emaSlow.step(source);
      // PPO = ((EMA_fast - EMA_slow) / EMA_slow) * 100
      const macd2 = (f == null || sl == null || sl === 0) ? NaN : ((f - sl) / sl) * 100;
      // d = SMA(PPO, smoother)
      const d = s.dSma.step(macd2, smoother) ?? NaN;
      const dArr = s.d;
      dArr[i] = d;
      const at = (k: number) => (i - k >= 0 ? dArr[i - k] : NaN);
      const L = (k: number) => (i - k >= 0 ? bars[i - k].low : NaN);
      const H = (k: number) => (i - k >= 0 ? bars[i - k].high : NaN);

      // --- Price bottoms/tops (priceMins / priceMax; na comparisons are false) ---
      const priceMins = (L(0) > L(1) && L(1) < L(2))
        || (L(1) === L(2) && L(1) < L(0) && L(1) < L(3))
        || (L(1) === L(2) && L(1) === L(3) && L(1) < L(0) && L(1) < L(4))
        || (L(1) === L(2) && L(1) === L(3) && L(1) !== 0 && L(1) === L(4) && L(1) < L(0) && L(1) < L(5));
      const priceMax = (H(0) < H(1) && H(1) > H(2))
        || (H(1) === H(2) && H(1) > H(0) && H(1) > H(3))
        || (H(1) === H(2) && H(1) === H(3) && H(1) > H(0) && H(1) > H(4))
        || (H(1) === H(2) && H(1) === H(3) && H(1) !== 0 && H(1) === H(4) && H(1) > H(0) && H(1) > H(5));

      // --- Oscillator bottoms/tops ---
      const oscMins = gt(d, at(1)) && lt(at(1), at(2));
      const oscMax = lt(d, at(1)) && gt(at(1), at(2));

      const d1 = at(1);
      const low1 = L(1);
      const high1 = H(1);

      const ct4 = vw.ct4.step(oscMins, d1);
      const ct5 = vw.ct5.step(oscMax, d1);
      const ct6 = vw.ct6.step(priceMins, low1);
      const ct7 = vw.ct7.step(priceMax, high1);

      // barssince(cond): 0 on a bar where cond is true, na before the first true bar
      const since = (c: boolean, prev: number) => (c ? 0 : isNaN(prev) ? NaN : prev + 1);
      v.bsOscMins = since(oscMins, v.bsOscMins);
      v.bsOscMax = since(oscMax, v.bsOscMax);
      v.bsPriceMins = since(priceMins, v.bsPriceMins);
      v.bsPriceMax = since(priceMax, v.bsPriceMax);

      // delayedlow / delayedhigh: price bottom/top within 3 bars of the oscillator one
      const delayedlow = priceMins && v.bsOscMins < 3 ? low1 : NaN;
      const delayedhigh = priceMax && v.bsOscMax < 3 ? high1 : NaN;

      // filter / filter2: tops/bottoms in price less than 5 bars away
      const low6 = s.low6.step(ct6, 4) ?? NaN;
      const high7 = s.high7.step(ct7, 4) ?? NaN;
      const filter = v.bsPriceMins < 5 ? low6 : NaN;
      const filter2 = v.bsPriceMax < 5 ? high7 : NaN;

      const y2 = vw.y2.step(oscMax, filter2);
      const y6 = vw.y6.step(oscMins, filter);
      const longTermBullFilt = vw.bull.step(priceMins, s.lowestLow.step(b.low, divLookbackPeriod) ?? NaN);
      const longTermBearFilt = vw.bear.step(priceMax, s.highestHigh.step(b.high, divLookbackPeriod) ?? NaN);
      const y3 = vw.y3.step(oscMax, ct5);
      const y4 = vw.y4.step(oscMax, ct5);
      const y7 = vw.y7.step(oscMins, ct4);
      const y8 = vw.y8.step(oscMins, ct4);
      const y9 = vw.y9.step(oscMins, ct6);
      const y10 = vw.y10.step(oscMax, ct7);

      const highestD = s.highestD.step(d, divLookbackPeriod) ?? NaN;
      const lowestD = s.lowestD.step(d, divLookbackPeriod) ?? NaN;

      const iBear = lt(ct5, highestD);              // i  : long term bearish oscillator divergence
      const i2 = gt(y10, longTermBearFilt);         // i2 : long term bearish top divergence
      const i3 = gt(delayedhigh, longTermBearFilt); // i3 : long term bearish delayed high divergence
      const i4 = gt(ct4, lowestD);                  // i4 : long term bullish oscillator divergence
      const i5 = lt(y9, longTermBullFilt);          // i5 : long term bullish bottom divergence
      const i6 = lt(delayedlow, longTermBullFilt);  // i6 : long term bullish delayed bottom divergence
      const cond = [
        gt(y10, y2) && oscMax && lt(y3, y4),
        lt(y9, y6) && oscMins && gt(y7, y8),
        lt(delayedlow, y6) && gt(y7, y8),
        gt(delayedhigh, y2) && lt(y3, y4),
        longTermDiv && oscMax && iBear && i2,
        longTermDiv && oscMins && i4 && i5,
        longTermDiv && iBear && i3,
        longTermDiv && i4 && i6,
      ];

      // plot(d); bulldiv / beardiv = d[1] at oscillator bottoms / tops, drawn with offset -1 (on the previous bar)
      const time = b.time;
      s.plot0[i] = { time, value: d };
      s.plot1[i] = { time, value: NaN };
      s.plot2[i] = { time, value: NaN };
      if (i > 0) {
        const t1 = bars[i - 1].time;
        s.plot1[i - 1] = { time: t1, value: oscMins ? d1 : NaN };
        s.plot2[i - 1] = { time: t1, value: oscMax ? d1 : NaN };
      }
      for (let k = 0; k < 8; k++) s.divPlots[k][i] = { time, value: cond[k] ? d : NaN };
    },
    result(s) {
      const dp = s.divPlots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plot0.slice(),
          'plot1': s.plot1.slice(),
          'plot2': s.plot2.slice(),
          'plot3': dp[0].slice(),
          'plot4': dp[1].slice(),
          'plot5': dp[2].slice(),
          'plot6': dp[3].slice(),
          'plot7': dp[4].slice(),
          'plot8': dp[5].slice(),
          'plot9': dp[6].slice(),
          'plot10': dp[7].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PPODivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PPODivergenceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PPODivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
