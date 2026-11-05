/**
 * Market Structure Oscillator [LuxAlgo]
 *
 * Three levels of swing points are tracked. A short term swing high is a high that is above the high before it and
 * not below the high after it (swing low: the mirror). An intermediate term swing is a short term swing that is
 * higher (lower) than the short term swings around it, and a long term swing is the same on the intermediate swings.
 * A close above the last swing high of a level that was not crossed yet is a bullish structure break of that level,
 * a close below the last swing low a bearish one.
 * Each level gives an oscillator: the position of the close between the lowest close and the highest close kept
 * since the last change of direction (0 to 100), smoothed by an SMA. The Market Structure Oscillator is the
 * weighted average of the three. The cycle histogram is the oscillator minus its EMA, drawn around 50 as candles.
 * Options: dots on the price chart when the oscillator or the cycle crosses 50, the structure breaks of each level
 * as lines (with "BoS" / "CHoCH" texts) on the price chart, and the oscillator of each level.
 *
 * Drawings are kept up to 500 lines, 500 boxes and 500 labels (the oldest are removed).
 *
 * Reference: "Market Structure Oscillator [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type LineStyleName = 'Solid' | 'Dashed' | 'Dotted';
type Toggle = 'Enabled' | 'Disabled';

export interface MarketStructureOscillatorInputs {
  /** Market Structure Oscillator */
  msOscShow: boolean;
  /** Short Term Weight */
  msWeightK1: number;
  /** Intermediate Term Weight */
  msWeightK2: number;
  /** Long Term Weight */
  msWeightK3: number;
  /** Oscillator Smoothing */
  normSmooth: number;
  msBullColor: string;
  msBearColor: string;
  /** Market Structure Oscillator - Crosses (Signals) */
  oscSig: boolean;
  oBullColor: string;
  oBearColor: string;
  /** Cycle Oscillator - Histogram */
  cycleOpt: boolean;
  /** Cycle Signal Length */
  cycSmooth: number;
  cBullColor: string;
  cBearColor: string;
  /** Cycle Oscillator - Crosses (Signals) */
  cycleSig: boolean;
  sBullColor: string;
  sBearColor: string;
  /** Short Term Structures */
  msOnChart1: boolean;
  msOnChartK1: LineStyleName;
  stMSLblK1T: Toggle;
  cBullColorK1: string;
  cBearColorK1: string;
  /** Intermediate Term Structures */
  msOnChart2: boolean;
  msOnChartK2: LineStyleName;
  stMSLblK2T: Toggle;
  cBullColorK2: string;
  cBearColorK2: string;
  /** Long Term Structures */
  msOnChart3: boolean;
  msOnChartK3: LineStyleName;
  stMSLblK3T: Toggle;
  cBullColorK3: string;
  cBearColorK3: string;
  /** Short Term Oscillator */
  msDataK1: boolean;
  msColorK1: string;
  /** Intermediate Term Oscillator */
  msDataK2: boolean;
  msColorK2: string;
  /** Long Term Oscillator */
  msDataK3: boolean;
  msColorK3: string;
}

const HIST_BULL = 'rgba(144, 191, 249, 0.75)';
const HIST_BEAR = 'rgba(255, 204, 128, 0.75)';
const HALF_GRAY = 'rgba(120, 123, 134, 0.5)';

export const defaultInputs: MarketStructureOscillatorInputs = {
  msOscShow: true,
  msWeightK1: 1,
  msWeightK2: 3,
  msWeightK3: 2,
  normSmooth: 4,
  msBullColor: '#3179f5',
  msBearColor: '#ffa726',
  oscSig: false,
  oBullColor: '#3179f5',
  oBearColor: '#ffa726',
  cycleOpt: true,
  cycSmooth: 7,
  cBullColor: HIST_BULL,
  cBearColor: HIST_BEAR,
  cycleSig: false,
  sBullColor: HIST_BULL,
  sBearColor: HIST_BEAR,
  msOnChart1: false,
  msOnChartK1: 'Dotted',
  stMSLblK1T: 'Disabled',
  cBullColorK1: '#089981',
  cBearColorK1: '#f23645',
  msOnChart2: false,
  msOnChartK2: 'Dashed',
  stMSLblK2T: 'Disabled',
  cBullColorK2: '#089981',
  cBearColorK2: '#f23645',
  msOnChart3: false,
  msOnChartK3: 'Solid',
  stMSLblK3T: 'Enabled',
  cBullColorK3: '#089981',
  cBearColorK3: '#f23645',
  msDataK1: false,
  msColorK1: HALF_GRAY,
  msDataK2: false,
  msColorK2: HALF_GRAY,
  msDataK3: false,
  msColorK3: HALF_GRAY,
};

const G1 = 'Market Structure Oscillator';
const G2 = 'Cycle Oscillator';
const G3 = 'Market Structures on Chart';
const G4 = 'Oscillator Components';
const STYLES = ['Solid', 'Dashed', 'Dotted'];
const TOGGLE = ['Enabled', 'Disabled'];

export const inputConfig: InputConfig[] = [
  { id: 'msOscShow', type: 'bool', title: 'Market Structure Oscillator', defval: true, group: G1 },
  { id: 'msWeightK1', type: 'float', title: '  Short Term Weight', defval: 1, min: 0, step: 0.1, group: G1 },
  { id: 'msWeightK2', type: 'float', title: '  Intermediate Term Weight', defval: 3, min: 0, step: 0.1, group: G1 },
  { id: 'msWeightK3', type: 'float', title: '  Long Term Weight', defval: 2, min: 0, step: 0.1, group: G1 },
  { id: 'normSmooth', type: 'int', title: '  Oscillator Smoothing', defval: 4, min: 1, group: G1 },
  { id: 'msBullColor', type: 'color', title: '  Gradient Colors: Bullish', defval: '#3179f5', inline: 'MS', group: G1 },
  { id: 'msBearColor', type: 'color', title: 'Bearish', defval: '#ffa726', inline: 'MS', group: G1 },
  { id: 'oscSig', type: 'bool', title: 'Market Structure Oscillator - Crosses (Signals)', defval: false, group: G1 },
  { id: 'oBullColor', type: 'color', title: '  Signal Colors: Bullish', defval: '#3179f5', inline: 'SIG', group: G1 },
  { id: 'oBearColor', type: 'color', title: 'Bearish', defval: '#ffa726', inline: 'SIG', group: G1 },
  { id: 'cycleOpt', type: 'bool', title: 'Cycle Oscillator - Histogram', defval: true, group: G2 },
  { id: 'cycSmooth', type: 'int', title: '  Cycle Signal Length', defval: 7, min: 1, group: G2 },
  { id: 'cBullColor', type: 'color', title: '  Histogram Colors: Bullish', defval: HIST_BULL, inline: 'CYC', group: G2 },
  { id: 'cBearColor', type: 'color', title: 'Bearish', defval: HIST_BEAR, inline: 'CYC', group: G2 },
  { id: 'cycleSig', type: 'bool', title: 'Cycle Oscillator - Crosses (Signals)', defval: false, group: G2 },
  { id: 'sBullColor', type: 'color', title: '  Signal Colors: Bullish', defval: HIST_BULL, inline: 'SIG', group: G2 },
  { id: 'sBearColor', type: 'color', title: 'Bearish', defval: HIST_BEAR, inline: 'SIG', group: G2 },
  { id: 'msOnChart1', type: 'bool', title: 'Short Term Structures', defval: false, group: G3 },
  { id: 'msOnChartK1', type: 'string', title: '  Line', defval: 'Dotted', options: STYLES, inline: 'K1', group: G3 },
  { id: 'stMSLblK1T', type: 'string', title: 'Labels', defval: 'Disabled', options: TOGGLE, inline: 'K1', group: G3 },
  { id: 'cBullColorK1', type: 'color', title: '  Colors: Bullish', defval: '#089981', inline: 'K1c', group: G3 },
  { id: 'cBearColorK1', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'K1c', group: G3 },
  { id: 'msOnChart2', type: 'bool', title: 'Intermediate Term Structures', defval: false, group: G3 },
  { id: 'msOnChartK2', type: 'string', title: '  Line', defval: 'Dashed', options: STYLES, inline: 'K2', group: G3 },
  { id: 'stMSLblK2T', type: 'string', title: 'Labels', defval: 'Disabled', options: TOGGLE, inline: 'K2', group: G3 },
  { id: 'cBullColorK2', type: 'color', title: '  Colors: Bullish', defval: '#089981', inline: 'K2c', group: G3 },
  { id: 'cBearColorK2', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'K2c', group: G3 },
  { id: 'msOnChart3', type: 'bool', title: 'Long Term Structures', defval: false, group: G3 },
  { id: 'msOnChartK3', type: 'string', title: '  Line', defval: 'Solid', options: STYLES, inline: 'K3', group: G3 },
  { id: 'stMSLblK3T', type: 'string', title: 'Labels', defval: 'Enabled', options: TOGGLE, inline: 'K3', group: G3 },
  { id: 'cBullColorK3', type: 'color', title: '  Colors: Bullish', defval: '#089981', inline: 'K3c', group: G3 },
  { id: 'cBearColorK3', type: 'color', title: 'Bearish', defval: '#f23645', inline: 'K3c', group: G3 },
  { id: 'msDataK1', type: 'bool', title: 'Short Term Oscillator', defval: false, inline: 'k1w', group: G4 },
  { id: 'msColorK1', type: 'color', title: '', defval: HALF_GRAY, inline: 'k1w', group: G4 },
  { id: 'msDataK2', type: 'bool', title: 'Intermediate Term Oscillator', defval: false, inline: 'k2w', group: G4 },
  { id: 'msColorK2', type: 'color', title: '', defval: HALF_GRAY, inline: 'k2w', group: G4 },
  { id: 'msDataK3', type: 'bool', title: 'Long Term Oscillator', defval: false, inline: 'k3w', group: G4 },
  { id: 'msColorK3', type: 'color', title: '', defval: HALF_GRAY, inline: 'k3w', group: G4 },
];

const MID_COLOR = String(color.new('#787b86', 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OSC Top', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Overbought Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Equilibrium Level', color: MID_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Oversold Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'OSC Bottom', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Market Structure Oscillator', color: '#3179f5', lineWidth: 1 },
  { id: 'plot6', title: 'Short Term Oscillator', color: HALF_GRAY, lineWidth: 1 },
  { id: 'plot7', title: 'Intermediate Term Oscillator', color: HALF_GRAY, lineWidth: 1 },
  { id: 'plot8', title: 'Long Term Oscillator', color: HALF_GRAY, lineWidth: 1 },
];

export const metadata = {
  title: 'Market Structure Oscillator [LuxAlgo]',
  shortTitle: 'LuxAlgo - Market Structure Oscillator',
  overlay: false,
};

/** indicator(max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;

/** The last three swing points of one kind (SWINGS of the script) */
interface Swings {
  lastPrice: number;
  midPrice: number;
  prevPrice: number;
  lastIndex: number;
  midIndex: number;
  prevIndex: number;
  isCrossed: boolean;
}

const newSwings = (): Swings => ({
  lastPrice: NaN, midPrice: NaN, prevPrice: NaN, lastIndex: NaN, midIndex: NaN, prevIndex: NaN, isCrossed: false,
});

function updatePattern(s: Swings, price: number, index: number): void {
  s.isCrossed = false;
  s.prevPrice = s.midPrice;
  s.midPrice = s.lastPrice;
  s.lastPrice = price;
  s.prevIndex = s.midIndex;
  s.midIndex = s.lastIndex;
  s.lastIndex = index;
}

/** queryPatterns: the middle of three points is a swing high (or a swing low) */
function queryPatterns(lastPrice: number, midPrice: number, prevPrice: number, isSwingHigh: boolean): boolean {
  return isSwingHigh ? gt(midPrice, prevPrice) && ge(midPrice, lastPrice) : gt(prevPrice, midPrice) && ge(lastPrice, midPrice);
}

/** The state of normalize() of the script without its SMA: one per call */
interface NormState {
  os: number;
  prevOs: number;
  max: number;
  min: number;
}

const newNorm = (): NormState => ({ os: 0, prevOs: NaN, max: NaN, min: NaN });

function normalize(s: NormState, close: number, buy: boolean, sell: boolean): number {
  s.os = buy ? 1 : sell ? -1 : s.os;
  // math.max / math.min give na while max / min are na
  s.max = s.os > s.prevOs ? close : s.os < s.prevOs ? s.max : Number.isNaN(s.max) ? NaN : Math.max(close, s.max);
  s.min = s.os < s.prevOs ? close : s.os > s.prevOs ? s.min : Number.isNaN(s.min) ? NaN : Math.min(close, s.min);
  s.prevOs = s.os;
  return (close - s.min) / (s.max - s.min);
}

/**
 * The drawings kept by the drawing count limit of Pine (above max + 5 objects of one kind the oldest are deleted until
 * max remain) after `count` objects were created: the last ones of the list of every object created
 */
function kept<T>(all: T[]): T[] {
  const count = all.length;
  const keep = count <= MAX_OBJECTS + 5 ? count : MAX_OBJECTS + ((count - MAX_OBJECTS - 6) % 6);
  return all.slice(count - keep);
}

type Point = { time: number; value: number; color?: string };

interface MsoVars {
  /** Swings of the levels: short term, intermediate term, long term (high, low) */
  stHigh: Swings;
  stLow: Swings;
  itHigh: Swings;
  itLow: Swings;
  ltHigh: Swings;
  ltLow: Swings;
  msType: number[];
  norms: NormState[];
  /** cSwingHigh[1] / cSwingLow[1] of the two marketStructure() calls */
  prevSwing: { high: boolean; low: boolean }[];
}

interface MsoRun extends BarRunState<MsoVars> {
  smas: ReturnType<typeof taStep.sma>[];
  ema: ReturnType<typeof taStep.ema>;
  msOSC: number[];
  cycleFast: number[];
  /** plot0 .. plot8 */
  plots: Point[][];
  /** Every drawing created (the limit is applied in the result) */
  lines: LineDrawingData[];
  boxes: BoxData[];
  labels: LabelData[];
  candles: PlotCandleData[];
}

const copySwings = (s: Swings): Swings => ({ ...s });

function study(inputs: Partial<MarketStructureOscillatorInputs>): BarStudy<MsoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const lineStyle = (s: LineStyleName) => (s === 'Dotted' ? 'dotted' : s === 'Dashed' ? 'dashed' : 'solid');
  const levels = [
    { on: cfg.msOnChart1, style: lineStyle(cfg.msOnChartK1), labels: cfg.stMSLblK1T === 'Enabled', bull: cfg.cBullColorK1, bear: cfg.cBearColorK1 },
    { on: cfg.msOnChart2, style: lineStyle(cfg.msOnChartK2), labels: cfg.stMSLblK2T === 'Enabled', bull: cfg.cBullColorK2, bear: cfg.cBearColorK2 },
    { on: cfg.msOnChart3, style: lineStyle(cfg.msOnChartK3), labels: cfg.stMSLblK3T === 'Enabled', bull: cfg.cBullColorK3, bear: cfg.cBearColorK3 },
  ] as const;
  const weights = [cfg.msWeightK1, cfg.msWeightK2, cfg.msWeightK3];
  const anyOsc = cfg.msOscShow || cfg.msDataK1 || cfg.msDataK2 || cfg.msDataK3;
  const components = [
    { on: cfg.msDataK1, col: cfg.msColorK1 }, { on: cfg.msDataK2, col: cfg.msColorK2 }, { on: cfg.msDataK3, col: cfg.msColorK3 },
  ];

  /** marketStructure(): swings of a level from the swings of the level below; returns bull, bear (bit 1, bit 2) */
  const marketStructure = (v: MsoVars, site: number, hHigh: Swings, hLow: Swings, lHigh: Swings, lLow: Swings, close: number, first: boolean) => {
    let bull = false;
    let bear = false;
    const prev = v.prevSwing[site];
    const cHigh = queryPatterns(lHigh.lastPrice, lHigh.midPrice, lHigh.prevPrice, true);
    // cSwingHigh != cSwingHigh[1]: na on the first bar
    if (cHigh && !first && cHigh !== prev.high) {
      updatePattern(hHigh, lHigh.midPrice, lHigh.midIndex);
      hHigh.isCrossed = false;
    }
    if (gt(close, hHigh.lastPrice) && !hHigh.isCrossed) {
      hHigh.isCrossed = true;
      bull = true;
    }
    const cLow = queryPatterns(lLow.lastPrice, lLow.midPrice, lLow.prevPrice, false);
    if (cLow && !first && cLow !== prev.low) {
      updatePattern(hLow, lLow.midPrice, lLow.midIndex);
      hLow.isCrossed = false;
    }
    if (gt(hLow.lastPrice, close) && !hLow.isCrossed) {
      hLow.isCrossed = true;
      bear = true;
    }
    prev.high = cHigh;
    prev.low = cLow;
    return (bull ? 1 : 0) | (bear ? 2 : 0);
  };

  return {
    init() {
      const s: MsoRun = {
        smas: [taStep.sma(), taStep.sma(), taStep.sma()], ema: taStep.ema(cfg.cycSmooth),
        msOSC: [], cycleFast: [], plots: Array.from({ length: 9 }, () => []),
        lines: [], boxes: [], labels: [], candles: [],
        steps: [],
        vars: {
          stHigh: newSwings(), stLow: newSwings(), itHigh: newSwings(), itLow: newSwings(), ltHigh: newSwings(),
          ltLow: newSwings(), msType: [0, 0, 0], norms: [newNorm(), newNorm(), newNorm()],
          prevSwing: [{ high: false, low: false }, { high: false, low: false }],
        },
        lists: [], series: [],
      };
      s.steps = [...s.smas, ...(cfg.cycleOpt ? [s.ema] : [])];
      s.lists = [s.lines, s.boxes, s.labels, s.candles];
      s.series = [s.msOSC, s.cycleFast, ...s.plots];
      return s;
    },
    copyVars: (v) => ({
      stHigh: copySwings(v.stHigh), stLow: copySwings(v.stLow), itHigh: copySwings(v.itHigh), itLow: copySwings(v.itLow),
      ltHigh: copySwings(v.ltHigh), ltLow: copySwings(v.ltLow), msType: v.msType.slice(),
      norms: v.norms.map((x) => ({ ...x })), prevSwing: v.prevSwing.map((x) => ({ ...x })),
    }),
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const close = bar.close;
      const time = bar.time;
      const { stHigh, stLow, itHigh, itLow, ltHigh, ltLow, msType } = v;
      const highs = [stHigh, itHigh, ltHigh];
      const lows = [stLow, itLow, ltLow];

      // Market structures on the chart: they read the swings as they were after the bar before
      for (let k = 0; k < 3; k++) {
        const lv = levels[k];
        if (!lv.on) continue;
        const high = highs[k];
        const low = lows[k];
        if (gt(close, high.lastPrice) && !high.isCrossed) {
          const x1 = bars[high.lastIndex].time;
          const y = high.lastPrice;
          s.lines.push({ time1: x1, price1: y, time2: time, price2: y, color: lv.bull, style: lv.style, width: 1, forceOverlay: true });
          if (lv.labels) {
            s.boxes.push({
              time1: x1, price1: y, time2: time, price2: y, borderColor: 'transparent', text: msType[k] < 0 ? 'CHoCH' : 'BoS',
              textColor: lv.bull, textSize: 'tiny', textHAlign: 'left', textVAlign: 'bottom', forceOverlay: true,
            });
            msType[k] = 1;
          }
        }
        if (gt(low.lastPrice, close) && !low.isCrossed) {
          const x1 = bars[low.lastIndex].time;
          const y = low.lastPrice;
          s.lines.push({ time1: x1, price1: y, time2: time, price2: y, color: lv.bear, style: lv.style, width: 1, forceOverlay: true });
          if (lv.labels) {
            s.boxes.push({
              time1: x1, price1: y, time2: time, price2: y, borderColor: 'transparent', text: msType[k] > 0 ? 'CHoCH' : 'BoS',
              textColor: lv.bear, textSize: 'tiny', textHAlign: 'left', textVAlign: 'top', forceOverlay: true,
            });
            msType[k] = -1;
          }
        }
      }

      // shortMarketStructure()
      let bull = false;
      let bear = false;
      if (i >= 2 && queryPatterns(bar.high, bars[i - 1].high, bars[i - 2].high, true)) {
        updatePattern(stHigh, bars[i - 1].high, i - 1);
        stHigh.isCrossed = false;
      }
      if (gt(close, stHigh.lastPrice) && !stHigh.isCrossed) {
        stHigh.isCrossed = true;
        bull = true;
      }
      if (i >= 2 && queryPatterns(bar.low, bars[i - 1].low, bars[i - 2].low, false)) {
        stLow.isCrossed = false;
        updatePattern(stLow, bars[i - 1].low, i - 1);
      }
      if (gt(stLow.lastPrice, close) && !stLow.isCrossed) {
        stLow.isCrossed = true;
        bear = true;
      }
      const raw0 = normalize(v.norms[0], close, bull, bear);
      const ms2 = marketStructure(v, 0, itHigh, itLow, stHigh, stLow, close, i === 0);
      const raw1 = normalize(v.norms[1], close, (ms2 & 1) !== 0, (ms2 & 2) !== 0);
      const ms3 = marketStructure(v, 1, ltHigh, ltLow, itHigh, itLow, close, i === 0);
      const raw2 = normalize(v.norms[2], close, (ms3 & 1) !== 0, (ms3 & 2) !== 0);

      // ta.sma((bar.close - min) / (max - min), smooth) * 100
      const st0 = s.smas[0].step(raw0, cfg.normSmooth) * 100;
      const st1 = s.smas[1].step(raw1, cfg.normSmooth) * 100;
      const st2 = s.smas[2].step(raw2, cfg.normSmooth) * 100;
      let num = 0;
      let den = 0;
      for (let k = 0; k < 3; k++) {
        const x = k === 0 ? st0 : k === 1 ? st1 : st2;
        // nz() and na() take an infinite value as na
        const isNa = !Number.isFinite(x);
        num += weights[k] * (isNa ? 0 : x);
        den += weights[k] * (isNa ? 0 : 1);
      }
      const msOSC = num / den;
      s.msOSC[i] = msOSC;

      // cycleFast = cycleOpt ? msOSC - ta.ema(msOSC, cyc_Smooth) + 50 : 50
      const c = cfg.cycleOpt ? msOSC - (s.ema.step(msOSC) ?? NaN) + 50 : 50;
      s.cycleFast[i] = c;

      const p = s.plots;
      const lvl = anyOsc;
      p[0][i] = { time, value: lvl ? 100 : NaN };
      p[1][i] = { time, value: lvl ? 85 : NaN };
      p[2][i] = { time, value: lvl ? 50 : NaN, color: MID_COLOR };
      p[3][i] = { time, value: lvl ? 15 : NaN };
      p[4][i] = { time, value: lvl ? 0 : NaN };
      const shown = cfg.msOscShow && Number.isFinite(msOSC);
      const col = color.from_gradient(msOSC, 0, 100, cfg.msBearColor, cfg.msBullColor);
      p[5][i] = { time, value: shown ? msOSC : NaN, ...(col ? { color: String(col) } : {}) };
      for (let k = 0; k < 3; k++) {
        const x = k === 0 ? st0 : k === 1 ? st1 : st2;
        p[6 + k][i] = { time, value: components[k].on && Number.isFinite(x) ? x : NaN, color: components[k].col };
      }

      // Signals: a dot on the price chart when the oscillator (or the cycle) crosses 50
      const signals = (on: boolean, values: number[], bullColor: string, bearColor: string) => {
        if (!on || i === 0) return;
        const change = Math.sign(values[i] - 50) - Math.sign(values[i - 1] - 50);
        if (change > 0) {
          s.labels.push({ time, price: bar.low, text: '⦁', color: 'transparent', textColor: bullColor, style: 'label_up', forceOverlay: true });
        }
        if (change < 0) {
          s.labels.push({ time, price: bar.high, text: '⦁', color: 'transparent', textColor: bearColor, style: 'label_down', forceOverlay: true });
        }
      };
      signals(cfg.oscSig, s.msOSC, cfg.oBullColor, cfg.oBearColor);
      // plotcandle(50., 50., 50., cycleFast, ...): no candle while the value is na
      if (Number.isFinite(c)) {
        const body = gt(c, 50) ? cfg.cBullColor : cfg.cBearColor;
        s.candles.push({
          time, open: 50, high: 50, low: 50, close: c, color: body, borderColor: cfg.cycleOpt ? body : '#787B86',
          wickColor: '#737375',
        });
      }
      signals(cfg.cycleSig, s.cycleFast, cfg.sBullColor, cfg.sBearColor);
    },
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T) => new Array<T>(n).fill(v);
      const bull0 = String(color.new(cfg.msBullColor, 0));
      const bull73 = String(color.new(cfg.msBullColor, 73));
      const bull100 = String(color.new(cfg.msBullColor, 100));
      const bear0 = String(color.new(cfg.msBearColor, 0));
      const bear73 = String(color.new(cfg.msBearColor, 73));
      const bear100 = String(color.new(cfg.msBearColor, 100));
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          // Overbought Fill
          { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: constant(100), bottomValue: constant(85), topColor: constant(bear100), bottomColor: constant(bear73) } },
          // Oversold Fill
          { plot1: 'plot3', plot2: 'plot4', gradient: { topValue: constant(15), bottomValue: constant(0), topColor: constant(bull73), bottomColor: constant(bull100) } },
          // Bullish Gradient Fill
          { plot1: 'plot5', plot2: 'plot2', gradient: { topValue: constant(100), bottomValue: constant(cfg.cycleOpt ? 60 : 50), topColor: constant(bull0), bottomColor: constant(bull100) } },
          // Bearish Gradient Fill
          { plot1: 'plot5', plot2: 'plot2', gradient: { topValue: constant(cfg.cycleOpt ? 40 : 50), bottomValue: constant(0), topColor: constant(bear100), bottomColor: constant(bear0) } },
        ],
        plotCandles: { cycleHistogram: s.candles.slice() },
        lines: kept(s.lines),
        boxes: kept(s.boxes),
        labels: kept(s.labels),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketStructureOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketStructureOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketStructureOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
