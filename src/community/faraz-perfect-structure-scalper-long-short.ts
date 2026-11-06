/**
 * Faraz Perfect Structure Scalper + Long Short
 *
 * Structure levels: the structure low is the low of the last pivot low (lowest low of 50 bars before the first
 * pivot), the structure high the high of the last pivot high; stop levels are these levels minus / plus a buffer.
 * The breakout / breakdown levels are the highest high / lowest low of the previous `lookbackBreakout` bars.
 * Base Long: close above the breakout level and the structure low, RSI above the long trigger and (optionally) a
 * rising MACD histogram; Base Short is the mirror. Perfect Long (XL) adds a close above the structure high, RSI at
 * or above the perfect minimum and rising, a 200 EMA rising more than the minimum slope over the lookback and a
 * close above it (bar coloured green); Perfect Short (XS) is the mirror (bar coloured red). The background is
 * orange when the close is between a structure level and the breakout / breakdown level (no-add zone). A scalp
 * engine gives Buy / Sell Scalp signals on crossings of a MACD (EMA fast - EMA slow) with its SMA signal, confirmed
 * by the direction of a TEMA.
 * Alerts (alertcondition, `alerts` of the result): XL Long / XS Short, Base Long / Short and Buy / Sell Scalp, true
 * on the bars of these signals.
 *
 * Reference: "Faraz Perfect Structure Scalper + Long Short (Indicator Alerts)" by fsaleem03
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FarazPerfectStructureScalperLongShortInputs {
  /** Swing pivot length (both sides) */
  pivotLen: number;
  /** Breakout / breakdown lookback */
  lookbackBreakout: number;
  /** RSI length */
  rsiLen: number;
  /** Base RSI long trigger */
  rsiLongTrig: number;
  /** Base RSI short trigger */
  rsiShortTrig: number;
  /** Perfect long RSI minimum */
  rsiPerfectLong: number;
  /** Perfect short RSI maximum */
  rsiPerfectShort: number;
  /** Use the MACD histogram filter */
  useMACD: boolean;
  /** Stop buffer (points) */
  riskBufferPts: number;
  /** Trend EMA length */
  emaLenTrend: number;
  /** Trend slope lookback bars */
  trendLookback: number;
  /** Minimum EMA slope (points) */
  minSlopePts: number;
  /** Scalp TEMA length */
  itgLen: number;
  /** Scalp fast EMA length */
  itgFastLength: number;
  /** Scalp slow EMA length */
  itgSlowLength: number;
  /** Scalp signal SMA length */
  itgSignalLength: number;
  /** Show the scalp TEMA line */
  showItgTema: boolean;
}

export const defaultInputs: FarazPerfectStructureScalperLongShortInputs = {
  pivotLen: 5,
  lookbackBreakout: 10,
  rsiLen: 14,
  rsiLongTrig: 40.0,
  rsiShortTrig: 60.0,
  rsiPerfectLong: 50.0,
  rsiPerfectShort: 50.0,
  useMACD: true,
  riskBufferPts: 5.0,
  emaLenTrend: 200,
  trendLookback: 10,
  minSlopePts: 5.0,
  itgLen: 14,
  itgFastLength: 12,
  itgSlowLength: 26,
  itgSignalLength: 9,
  showItgTema: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Swing Pivot Length (both sides)', defval: 5, min: 2 },
  { id: 'lookbackBreakout', type: 'int', title: 'Breakout / Breakdown Lookback', defval: 10, min: 3 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiLongTrig', type: 'float', title: 'Base RSI Long Trigger', defval: 40.0, min: 5, max: 95 },
  { id: 'rsiShortTrig', type: 'float', title: 'Base RSI Short Trigger', defval: 60.0, min: 5, max: 95 },
  { id: 'rsiPerfectLong', type: 'float', title: 'Perfect Long RSI Min', defval: 50.0, min: 5, max: 95 },
  { id: 'rsiPerfectShort', type: 'float', title: 'Perfect Short RSI Max', defval: 50.0, min: 5, max: 95 },
  { id: 'useMACD', type: 'bool', title: 'Use MACD filter?', defval: true },
  { id: 'riskBufferPts', type: 'float', title: 'Stop buffer (points)', defval: 5.0 },
  { id: 'emaLenTrend', type: 'int', title: 'Trend EMA length', defval: 200, min: 20 },
  { id: 'trendLookback', type: 'int', title: 'Trend slope lookback bars', defval: 10, min: 1 },
  { id: 'minSlopePts', type: 'float', title: 'Min EMA slope (points)', defval: 5.0, min: 0.0 },
  { id: 'itgLen', type: 'int', title: 'Scalp TEMA length', defval: 14, min: 1, group: 'Scalp Engine (ITG)' },
  { id: 'itgFastLength', type: 'int', title: 'Scalp fast EMA length', defval: 12, min: 1, group: 'Scalp Engine (ITG)' },
  { id: 'itgSlowLength', type: 'int', title: 'Scalp slow EMA length', defval: 26, min: 1, group: 'Scalp Engine (ITG)' },
  { id: 'itgSignalLength', type: 'int', title: 'Scalp signal SMA length', defval: 9, min: 1, group: 'Scalp Engine (ITG)' },
  { id: 'showItgTema', type: 'bool', title: 'Show scalp TEMA line', defval: true, group: 'Scalp Engine (ITG)' },
];

const RED = String(color.new(color.red, 0));
const RED_60 = String(color.new(color.red, 60));
const LIME = String(color.new(color.lime, 0));
const BLUE = String(color.new(color.blue, 0));
const BLUE_60 = String(color.new(color.blue, 60));
const ORANGE = String(color.new(color.orange, 0));
const BLUE_40 = String(color.new(color.blue, 40));
const GREEN = String(color.new(color.green, 0));
const BG_NO_ADD = String(color.new(color.orange, 88));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Structure Low (Red)', color: RED, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Long Stop Level', color: RED_60, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Long Breakout (Green)', color: LIME, lineWidth: 2, style: 'linebr' },
  { id: 'plot3', title: 'Structure High (Blue)', color: BLUE, lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Short Stop Level', color: BLUE_60, lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Short Breakdown (Orange)', color: ORANGE, lineWidth: 2, style: 'linebr' },
  { id: 'plot6', title: 'Scalp TEMA', color: BLUE_40, lineWidth: 2 },
];

export const metadata = {
  title: 'Faraz Perfect Structure XL / XS (Indicator Alerts)',
  shortTitle: 'Faraz Perfect Structure XL / XS (Indicator Alerts)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

const TEXT_LONG = String(color.rgb(6, 71, 247));
const TEXT_SHORT = String(color.rgb(18, 8, 1));
const TEXT_XS = String(color.rgb(118, 246, 6));
const TEXT_BUY = String(color.rgb(81, 5, 246));
const TEXT_SELL = String(color.rgb(247, 9, 9));

interface FarazRun extends BarRunState<Record<string, never>> {
  pivLow: PivotStep;
  pivHigh: PivotStep;
  lowWhen: ReturnType<typeof taStep.valuewhen>;
  highWhen: ReturnType<typeof taStep.valuewhen>;
  lowest50: ReturnType<typeof taStep.lowest>;
  highest50: ReturnType<typeof taStep.highest>;
  hiBo: ReturnType<typeof taStep.highest>;
  loBd: ReturnType<typeof taStep.lowest>;
  rsiStep: ReturnType<typeof taStep.rsi>;
  macd: ReturnType<typeof taStep.macd>;
  emaTrendStep: ReturnType<typeof taStep.ema>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ema3: ReturnType<typeof taStep.ema>;
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.sma>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  hiBoArr: number[];
  loBdArr: number[];
  rsi: number[];
  macdHist: number[];
  emaTrend: number[];
  itgTema: number[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FarazPerfectStructureScalperLongShortInputs>): BarStudy<FarazRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const pl = cfg.pivotLen;
  const prev = (a: number[], i: number, k = 1) => (i - k >= 0 ? a[i - k] : NaN);
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: FarazRun = {
        pivLow: new PivotStep(pl, pl, false), pivHigh: new PivotStep(pl, pl, true),
        lowWhen: taStep.valuewhen(0), highWhen: taStep.valuewhen(0),
        lowest50: taStep.lowest(), highest50: taStep.highest(), hiBo: taStep.highest(), loBd: taStep.lowest(),
        rsiStep: taStep.rsi(cfg.rsiLen), macd: taStep.macd(12, 26, 9), emaTrendStep: taStep.ema(cfg.emaLenTrend),
        ema1: taStep.ema(cfg.itgLen), ema2: taStep.ema(cfg.itgLen), ema3: taStep.ema(cfg.itgLen),
        fast: taStep.ema(cfg.itgFastLength), slow: taStep.ema(cfg.itgSlowLength), signal: taStep.sma(),
        up: taStep.crossover(), down: taStep.crossunder(),
        hiBoArr: [], loBdArr: [], rsi: [], macdHist: [], emaTrend: [], itgTema: [],
        plots: [[], [], [], [], [], [], []], markers: [], barColors: [], bgColors: [],
        flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [
        s.pivLow, s.pivHigh, s.lowWhen, s.highWhen, s.lowest50, s.highest50, s.hiBo, s.loBd, s.rsiStep, s.macd,
        s.emaTrendStep, s.ema1, s.ema2, s.ema3, s.fast, s.slow, s.signal, s.up, s.down,
      ];
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.hiBoArr, s.loBdArr, s.rsi, s.macdHist, s.emaTrend, s.itgTema, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const c = b.close;

      // Structure levels: ta.valuewhen(pivotLow, low[pivotLen], 0), else ta.lowest(low, 50) (and the mirror)
      const pivotLow = s.pivLow.step(i, b.low);
      const pivotHigh = s.pivHigh.step(i, b.high);
      const lowLb = i - pl >= 0 ? bars[i - pl].low : NaN; // low[pivotLen]
      const highLb = i - pl >= 0 ? bars[i - pl].high : NaN; // high[pivotLen]
      const pivotLowPrice = s.lowWhen.step(Number.isNaN(pivotLow) ? 0 : 1, lowLb);
      const pivotHighPrice = s.highWhen.step(Number.isNaN(pivotHigh) ? 0 : 1, highLb);
      const lowest50 = s.lowest50.step(b.low, 50);
      const highest50 = s.highest50.step(b.high, 50);
      const structLow = Number.isNaN(pivotLowPrice) ? lowest50 : pivotLowPrice;
      const structHigh = Number.isNaN(pivotHighPrice) ? highest50 : pivotHighPrice;
      const longStopLevel = structLow - cfg.riskBufferPts;
      const shortStopLevel = structHigh + cfg.riskBufferPts;

      // Breakout / breakdown levels of the previous bars ([1])
      s.hiBoArr[i] = s.hiBo.step(b.high, cfg.lookbackBreakout);
      s.loBdArr[i] = s.loBd.step(b.low, cfg.lookbackBreakout);
      const breakoutLvl = prev(s.hiBoArr, i);
      const breakdownLvl = prev(s.loBdArr, i);

      // Momentum filters
      const rsi = s.rsiStep.step(c);
      s.rsi[i] = rsi;
      const macdHist = s.macd.step(c)[2];
      s.macdHist[i] = macdHist;

      // Trend filter
      const emaTrend = s.emaTrendStep.step(c);
      s.emaTrend[i] = emaTrend;

      // Scalp engine: TEMA and MACD-style filter
      const e1 = s.ema1.step(c);
      const e2 = s.ema2.step(e1);
      const e3 = s.ema3.step(e2);
      const itgTema = 3.0 * (e1 - e2) + e3;
      s.itgTema[i] = itgTema;
      const itgMacd = s.fast.step(c) - s.slow.step(c);
      const itgSignal = s.signal.step(itgMacd, cfg.itgSignalLength);
      const crossUp = s.up.step(itgMacd, itgSignal);
      const crossDown = s.down.step(itgMacd, itgSignal);

      const macdUp = gt(macdHist, prev(s.macdHist, i));
      const macdDown = lt(macdHist, prev(s.macdHist, i));
      const rsiUp = gt(rsi, prev(s.rsi, i));
      const rsiDown = lt(rsi, prev(s.rsi, i));

      // emaTrendPB = nz(emaTrend[trendLookback], emaTrend)
      const pb = prev(s.emaTrend, i, cfg.trendLookback);
      const emaTrendPB = Number.isNaN(pb) ? emaTrend : pb;
      const emaSlope = emaTrend - emaTrendPB;
      const upTrend = gt(emaTrend, emaTrendPB) && gt(emaSlope, cfg.minSlopePts);
      const downTrend = lt(emaTrend, emaTrendPB) && lt(emaSlope, -cfg.minSlopePts);

      const baseLong = gt(c, breakoutLvl) && gt(c, structLow) && gt(rsi, cfg.rsiLongTrig) && (!cfg.useMACD || macdUp);
      const baseShort = lt(c, breakdownLvl) && lt(c, structHigh) && lt(rsi, cfg.rsiShortTrig) && (!cfg.useMACD || macdDown);
      const trendLongOnly = gt(c, structHigh) && gt(c, breakoutLvl);
      const trendShortOnly = lt(c, structLow) && lt(c, breakdownLvl);
      const perfectLong = baseLong && trendLongOnly && ge(rsi, cfg.rsiPerfectLong) && rsiUp && upTrend && gt(c, emaTrend);
      const perfectShort = baseShort && trendShortOnly && le(rsi, cfg.rsiPerfectShort) && rsiDown && downTrend && lt(c, emaTrend);

      const buyScalp = crossUp && gt(itgTema, prev(s.itgTema, i));
      const sellScalp = crossDown && lt(itgTema, prev(s.itgTema, i));
      const flags = [perfectLong, perfectShort, baseLong, baseShort, buyScalp, sellScalp];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }

      // No-add zone background
      const longNoAddZone = gt(c, structLow) && lt(c, breakoutLvl);
      const shortNoAddZone = lt(c, structHigh) && gt(c, breakdownLvl);
      if (longNoAddZone || shortNoAddZone) s.bgColors.push({ time: t, color: BG_NO_ADD });

      // barcolor(perfectLong ? green : perfectShort ? red : na)
      if (perfectLong) s.barColors.push({ time: t, color: GREEN });
      else if (perfectShort) s.barColors.push({ time: t, color: RED });

      const markers = s.markers;
      if (baseLong) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: LIME, text: 'Long',
          textColor: TEXT_LONG, size: 'tiny' });
      }
      if (baseShort) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: RED, text: 'Short',
          textColor: TEXT_SHORT, size: 'tiny' });
      }
      if (perfectLong) {
        markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'XL',
          textColor: color.black, size: 'small' });
      }
      if (perfectShort) {
        markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'XS',
          textColor: TEXT_XS, size: 'small' });
      }
      if (buyScalp) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#4caf50', text: 'Buy\nScalp',
          textColor: TEXT_BUY, size: 'small' });
      }
      if (sellScalp) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: RED, text: 'Sell\nScalp',
          textColor: TEXT_SELL, size: 'small' });
      }

      const plots = s.plots;
      plots[0][i] = { time: t, value: finite(structLow), color: RED };
      plots[1][i] = { time: t, value: finite(longStopLevel), color: RED_60 };
      plots[2][i] = { time: t, value: finite(breakoutLvl), color: LIME };
      plots[3][i] = { time: t, value: finite(structHigh), color: BLUE };
      plots[4][i] = { time: t, value: finite(shortStopLevel), color: BLUE_60 };
      plots[5][i] = { time: t, value: finite(breakdownLvl), color: ORANGE };
      plots[6][i] = { time: t, value: cfg.showItgTema ? finite(itgTema) : NaN, color: BLUE_40 };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(perfectLong / perfectShort / baseLong / baseShort / buyScalp / sellScalp)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FarazPerfectStructureScalperLongShortInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FarazPerfectStructureScalperLongShortInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Faraz XL Long Signal', message: 'Faraz Perfect Structure: XL LONG signal on {{ticker}} ({{interval}}).' },
  { id: 'alert1', title: 'Faraz XS Short Signal', message: 'Faraz Perfect Structure: XS SHORT signal on {{ticker}} ({{interval}}).' },
  { id: 'alert2', title: 'Faraz Base Long', message: 'Faraz Structure: Base LONG signal on {{ticker}} ({{interval}}).' },
  { id: 'alert3', title: 'Faraz Base Short', message: 'Faraz Structure: Base SHORT signal on {{ticker}} ({{interval}}).' },
  { id: 'alert4', title: 'Faraz Buy Scalp', message: 'Faraz ITG-style BUY SCALP on {{ticker}} ({{interval}}).' },
  { id: 'alert5', title: 'Faraz Sell Scalp', message: 'Faraz ITG-style SELL SCALP on {{ticker}} ({{interval}}).' },
];

export const FarazPerfectStructureScalperLongShort = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
