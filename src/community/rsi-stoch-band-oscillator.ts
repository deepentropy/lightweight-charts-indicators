/**
 * RSI+Stoch Band Oscillator
 *
 * Price bands at which the RSI (Wilder averages of the up / down closes, as an EMA of length 2 * RSI length - 1) and
 * the slow Stochastic (%K of the previous bar, smoothed) would reach their overbought and oversold levels on the
 * current bar. The upper band is the higher of the RSI and Stochastic upper bands, the lower band the higher of the
 * lower bands. The oscillator is the close position between them (0 at the lower band, 100 at the upper band), with
 * fills above 100 (red) and below 0 (green). A price-pane background marks a fall after a close above the upper band
 * (red) or a rise after a close below the lower band (green), with optional RSI / Stochastic direction and ADX
 * filters (ADX of ta.dmi(14, 14) above the threshold and falling).
 *
 * Reference: "RSI+Stoch Band Oscillator" by nasu_is_gaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nasu_is_gaji
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiStochBandOscillatorInputs {
  /** The RSI must fall (rise) for a red (green) background */
  rsiFilter: boolean;
  rsiLength: number;
  rsiOb: number;
  rsiOs: number;
  /** The slow %K and %D must fall (rise) for a red (green) background */
  stochFilter: boolean;
  stochLengthK: number;
  stochSmoothK: number;
  stochLengthD: number;
  stochOb: number;
  stochOs: number;
  /** The ADX must be above the threshold and falling */
  adxFilter: boolean;
  /** Not used by the original script (the ADX is ta.dmi(14, 14)) */
  adxLength: number;
  /** Not used by the original script (the ADX is ta.dmi(14, 14)) */
  adxSmooth: number;
  adxThreshold: number;
}

export const defaultInputs: RsiStochBandOscillatorInputs = {
  rsiFilter: true,
  rsiLength: 14,
  rsiOb: 70,
  rsiOs: 30,
  stochFilter: false,
  stochLengthK: 14,
  stochSmoothK: 3,
  stochLengthD: 3,
  stochOb: 80,
  stochOs: 20,
  adxFilter: true,
  adxLength: 14,
  adxSmooth: 14,
  adxThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiFilter', type: 'bool', title: 'RSI Filter', defval: true, group: 'RSI' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, group: 'RSI' },
  { id: 'rsiOb', type: 'float', title: 'RSI Overbought', defval: 70, group: 'RSI' },
  { id: 'rsiOs', type: 'float', title: 'RSI Oversold', defval: 30, group: 'RSI' },
  { id: 'stochFilter', type: 'bool', title: 'Stochastic Filter', defval: false, group: 'Stochastic' },
  { id: 'stochLengthK', type: 'int', title: 'Stochastic %K Length', defval: 14, group: 'Stochastic' },
  { id: 'stochSmoothK', type: 'int', title: 'Stochastic %K Smooth', defval: 3, group: 'Stochastic' },
  { id: 'stochLengthD', type: 'int', title: 'Stochastic %D Length', defval: 3, group: 'Stochastic' },
  { id: 'stochOb', type: 'float', title: 'Stochastic Overbought', defval: 80, group: 'Stochastic' },
  { id: 'stochOs', type: 'float', title: 'Stochastic Oversold', defval: 20, group: 'Stochastic' },
  { id: 'adxFilter', type: 'bool', title: 'ADX Filter', defval: true, group: 'ADX' },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14, group: 'ADX' },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smooth Length', defval: 14, group: 'ADX' },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 25, group: 'ADX' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Line', color: color.silver, lineWidth: 1, display: 'pane' },
  { id: 'plot1', title: 'Oversold Line', color: color.silver, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Band Position', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI+Stoch Band Oscillator',
  shortTitle: 'RSI+Stoch Band Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

/** ta.falling(x, 1) / ta.rising(x, 1): the counter of falls (rises) from the previous bar (an na step keeps it) */
const monotonic = (count: number, v: number, prev: number, step: (a: number, b: number) => boolean): number =>
  Number.isFinite(v) && Number.isFinite(prev) ? (step(v, prev) ? count + 1 : 0) : count;

interface BandVars {
  /** fastK, slowK, osc, adx, rsi, slow %D of the bar before */
  fastK1: number;
  slowK1: number;
  osc1: number;
  adx1: number;
  rsi1: number;
  sD1: number;
  /** ta.falling / ta.rising counters of the RSI, slow %K and slow %D */
  rsiFall: number;
  rsiRise: number;
  skFall: number;
  skRise: number;
  sdFall: number;
  sdRise: number;
}

interface BandRun extends BarRunState<BandVars> {
  auc: ReturnType<typeof taStep.ema>;
  adc: ReturnType<typeof taStep.ema>;
  fastK: ReturnType<typeof taStep.stoch>;
  slowK: ReturnType<typeof taStep.sma>;
  sumSlowK1: ReturnType<typeof taStep.sum>;
  sumFastK1: ReturnType<typeof taStep.sum>;
  hh: ReturnType<typeof taStep.highest>;
  ll: ReturnType<typeof taStep.lowest>;
  osc: ReturnType<typeof taStep.stoch>;
  rsi: ReturnType<typeof taStep.rsi>;
  sD: ReturnType<typeof taStep.sma>;
  dmi: ReturnType<typeof taStep.dmi>;
  obLine: Point[];
  osLine: Point[];
  oscLine: Point[];
  upColors: string[];
  dnColors: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RsiStochBandOscillatorInputs>): BarStudy<BandRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { rsiLength, rsiOb, rsiOs, stochLengthK: lenK, stochSmoothK: smoothK, stochLengthD: lenD, stochOb, stochOs } = cfg;
  const bgRed = String(color.new(color.red, 70));
  const bgGreen = String(color.new(color.green, 70));
  const fillUp = String(color.new(color.red, 20));
  const fillDn = String(color.new(color.green, 20));
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // RSI bands: auc / adc = ta.ema(max(+-(close[1] - close[2]), 0), 2 * rsiLength - 1)
      const ep = 2 * rsiLength - 1;
      const auc = taStep.ema(ep);
      const adc = taStep.ema(ep);
      const fastK = taStep.stoch(lenK);
      const slowK = taStep.sma();
      const sumSlowK1 = taStep.sum();
      const sumFastK1 = taStep.sum();
      const hh = taStep.highest();
      const ll = taStep.lowest();
      const osc = taStep.stoch(1);
      const rsi = taStep.rsi(rsiLength);
      const sD = taStep.sma();
      const dmi = taStep.dmi(14, 14);
      const s: BandRun = {
        auc, adc, fastK, slowK, sumSlowK1, sumFastK1, hh, ll, osc, rsi, sD, dmi,
        obLine: [], osLine: [], oscLine: [], upColors: [], dnColors: [], bgColors: [],
        steps: [auc, adc, fastK, slowK, sumSlowK1, sumFastK1, hh, ll, osc, rsi, sD, dmi],
        vars: {
          fastK1: NaN, slowK1: NaN, osc1: NaN, adx1: NaN, rsi1: NaN, sD1: NaN,
          rsiFall: 0, rsiRise: 0, skFall: 0, skRise: 0, sdFall: 0, sdRise: 0,
        },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.obLine, s.osLine, s.oscLine, s.upColors, s.dnColors];
      return s;
    },
    bar(s, i, bars) {
      // math.sum(x, stochLengthD - 1) and math.sum(x, stochSmoothK - 1): a length of 0 is a Pine runtime error on bar 0
      if (i === 0 && (lenD - 1 < 1 || smoothK - 1 < 1)) {
        throw new Error("Invalid value of the 'length' argument (0.0) in the 'sum' function. It must be > 0.");
      }
      const v = s.vars;
      const b = bars[i];
      const close = b.close;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      const c2 = i > 1 ? bars[i - 2].close : NaN;
      const auc = s.auc.step(Math.max(c1 - c2, 0));
      const adc = s.adc.step(Math.max(c2 - c1, 0));
      const rsiBand = (level: number) => {
        const x = (rsiLength - 1) * ((adc * level) / (100 - level) - auc);
        return ge(x, 0) ? close + x : close + (x * (100 - level)) / level;
      };

      // Stochastic bands: fastK = ta.stoch(close[1], high[1], low[1], lenK), slowK = ta.sma(fastK, smoothK)
      const fastK = s.fastK.step(c1, i > 0 ? bars[i - 1].high : NaN, i > 0 ? bars[i - 1].low : NaN);
      const slowK = s.slowK.step(fastK, smoothK);
      const sumSlowK1 = s.sumSlowK1.step(v.slowK1, lenD - 1);
      const sumFastK1 = s.sumFastK1.step(v.fastK1, smoothK - 1);
      const hh = s.hh.step(b.high, lenK);
      const ll = s.ll.step(b.low, lenK);
      const stochPrice = (fk: number) => (fk * (hh - ll)) / 100 + ll;
      const stochBands = (level: number): [number, number] => {
        const sk = level * lenD - sumSlowK1;
        const fk1 = sk * smoothK - sumFastK1;
        const fk2 = level * smoothK - sumFastK1;
        return [stochPrice(fk1), stochPrice(fk2)];
      };
      const [x11, x12] = stochBands(stochOb);
      const [x21, x22] = stochBands(stochOs);
      // Pine math.max / math.min: na when an argument is na
      const stochUb = Math.max(x11, x12);
      const stochLb = Math.min(x21, x22);
      const upper = Math.max(stochUb, rsiBand(rsiOb));
      const lower = Math.max(stochLb, rsiBand(rsiOs));
      // osc = ta.stoch(close, max(stochUb, rsiUb), max(stochLb, rsiLb), 1)
      const osc = s.osc.step(close, upper, lower);

      const rsi = s.rsi.step(close);
      // sK = ta.sma(fastK, smoothK) (the slow %K), sD = ta.sma(slowK, lenD)
      const sK = slowK;
      const sD = s.sD.step(slowK, lenD);
      const adx = s.dmi.step(b.high, b.low, close)[2];

      v.rsiFall = monotonic(v.rsiFall, rsi, v.rsi1, lt);
      v.rsiRise = monotonic(v.rsiRise, rsi, v.rsi1, gt);
      v.skFall = monotonic(v.skFall, sK, v.slowK1, lt);
      v.skRise = monotonic(v.skRise, sK, v.slowK1, gt);
      v.sdFall = monotonic(v.sdFall, sD, v.sD1, lt);
      v.sdRise = monotonic(v.sdRise, sD, v.sD1, gt);
      const falling = (!cfg.rsiFilter || v.rsiFall >= 1) && (!cfg.stochFilter || (v.skFall >= 1 && v.sdFall >= 1));
      const rising = (!cfg.rsiFilter || v.rsiRise >= 1) && (!cfg.stochFilter || (v.skRise >= 1 && v.sdRise >= 1));
      const adxOk = !cfg.adxFilter || (gt(adx, cfg.adxThreshold) && gt(v.adx1, adx));
      if (adxOk && gt(v.osc1, 100) && falling) s.bgColors.push({ time: b.time, color: bgRed, forceOverlay: true });
      else if (adxOk && lt(v.osc1, 0) && rising) s.bgColors.push({ time: b.time, color: bgGreen, forceOverlay: true });
      // fill(oscline, obline, osc >= 100 ? red 20 : na); fill(oscline, osline, osc <= 0 ? green 20 : na)
      s.upColors[i] = ge(osc, 100) ? fillUp : 'transparent';
      s.dnColors[i] = le(osc, 0) ? fillDn : 'transparent';
      s.obLine[i] = { time: b.time, value: 100, color: color.silver };
      s.osLine[i] = { time: b.time, value: 0, color: color.silver };
      s.oscLine[i] = { time: b.time, value: finite(osc), color: color.green };

      v.fastK1 = fastK;
      v.slowK1 = slowK;
      v.osc1 = osc;
      v.adx1 = adx;
      v.rsi1 = rsi;
      v.sD1 = sD;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.obLine.slice(), plot1: s.osLine.slice(), plot2: s.oscLine.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', colors: s.upColors.slice() },
          { plot1: 'plot2', plot2: 'plot1', colors: s.dnColors.slice() },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiStochBandOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiStochBandOscillatorInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiStochBandOscillator = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
