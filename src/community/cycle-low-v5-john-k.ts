/**
 * Cycle Low (RSI + StochRSI)
 *
 * A cycle low signal from an RSI cross up through the oversold level and a StochRSI %K cross up through %D
 * (StochRSI = position of the RSI in its range over `len_stoch` bars, 50 on a flat range; %K = SMA, %D = SMA of
 * %K). Both crosses must happen on the same bar, or within one bar with the tolerance option. The previous bar must
 * be oversold on the RSI or on StochRSI (both in strict mode), and a score (RSI cross, StochRSI cross, RSI previous
 * oversold, StochRSI previous oversold: one point each) must reach the threshold. An optional anchor level (the
 * close of the bar that opens at the anchor time, or a manual price, times a multiplier) limits the signals to
 * closes near that level and is drawn as a line.
 * Alerts (alertcondition, `alerts` of the result): 'Cycle Low', true on the bars of the signal (also with the markers
 * hidden).
 *
 * Reference: "Cycle Low (RSI + StochRSI) – v1.1 (Strict + Score, Overlay)" by John_Kal
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface CycleLowRsiStochRsiInputs {
  src: SourceType;
  lenRsi: number;
  rsiOs: number;
  lenStoch: number;
  stochK: number;
  stochD: number;
  stochOs: number;
  oneBarTolerance: boolean;
  requirePrevOS: boolean;
  strictMode: boolean;
  scoreThreshold: number;
  useAnchor: boolean;
  /** Anchor candle open time (Unix ms, UTC) */
  anchorTime: number;
  useManualAnchorPrice: boolean;
  anchorPriceManual: number;
  anchorMult: number;
  anchorTol: number;
  plotLabels: boolean;
  /** Pine input "Background highlight?": the script has no bgcolor, so it changes nothing */
  showBg: boolean;
}

export const defaultInputs: CycleLowRsiStochRsiInputs = {
  src: 'close',
  lenRsi: 14,
  rsiOs: 33.0,
  lenStoch: 14,
  stochK: 3,
  stochD: 3,
  stochOs: 20.0,
  oneBarTolerance: true,
  requirePrevOS: true,
  strictMode: false,
  scoreThreshold: 3,
  useAnchor: false,
  anchorTime: 1735689600000,
  useManualAnchorPrice: false,
  anchorPriceManual: 0.0,
  anchorMult: 1.0,
  anchorTol: 0.02,
  plotLabels: true,
  showBg: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'lenRsi', type: 'int', title: 'RSI Length', defval: 14, min: 2 },
  { id: 'rsiOs', type: 'float', title: 'RSI Oversold (0–100)', defval: 33.0, min: 5, max: 60 },
  { id: 'lenStoch', type: 'int', title: 'StochRSI Length', defval: 14, min: 2 },
  { id: 'stochK', type: 'int', title: 'Stoch %K Smoothing', defval: 3, min: 1 },
  { id: 'stochD', type: 'int', title: 'Stoch %D Smoothing', defval: 3, min: 1 },
  { id: 'stochOs', type: 'float', title: 'StochRSI Oversold (0–100)', defval: 20.0, min: 1, max: 50 },
  { id: 'oneBarTolerance', type: 'bool', title: 'Allow RSI & Stoch crosses within 1 bar?', defval: true },
  { id: 'requirePrevOS', type: 'bool', title: 'Require prior oversold on RSI or Stoch?', defval: true },
  { id: 'strictMode', type: 'bool', title: 'Strict Mode (RSI<rsi_os & Stoch<stoch_os on previous bar)', defval: false },
  { id: 'scoreThreshold', type: 'int', title: 'Score threshold (0–4)', defval: 3, min: 0, max: 4 },
  { id: 'useAnchor', type: 'bool', title: 'Use Cycle Anchor Level?', defval: false },
  { id: 'anchorTime', type: 'time', title: 'Anchor Candle Time (UTC)', defval: 1735689600000 },
  { id: 'useManualAnchorPrice', type: 'bool', title: 'Use Manual Anchor Price?', defval: false },
  { id: 'anchorPriceManual', type: 'float', title: 'Manual Anchor Price', defval: 0.0, step: 0.0001 },
  { id: 'anchorMult', type: 'float', title: 'Anchor Range Multiplier', defval: 1.0, step: 0.001 },
  { id: 'anchorTol', type: 'float', title: 'Anchor proximity tolerance (fraction)', defval: 0.02, min: 0.0, max: 1.0, step: 0.001 },
  { id: 'plotLabels', type: 'bool', title: 'Plot signal markers?', defval: true },
  { id: 'showBg', type: 'bool', title: 'Background highlight?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Anchor Projection', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Cycle Low (RSI + StochRSI) – v1.1 (Strict + Score, Overlay)',
  shortTitle: 'Cycle Low (RSI + StochRSI) – v1.1 (Strict + Score, Overlay)',
  overlay: true,
};

/** Pine float comparisons: 1e-10 tolerance, na compares false */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CycleVars {
  /** ta.barssince(rsiCrossUp) / ta.barssince(stCrossUp) */
  barsRsi: number;
  barsSt: number;
  /** var float anchor_price_detected = na */
  anchorPriceDetected: number;
}

interface CycleRun extends BarRunState<CycleVars> {
  rsiStep: ReturnType<typeof taStep.rsi>;
  ll: WindowExtreme;
  hh: WindowExtreme;
  kSma: WindowSma;
  dSma: WindowSma;
  rsiCross: ReturnType<typeof taStep.crossover>;
  stCross: ReturnType<typeof taStep.crossover>;
  rsi: number[];
  k: number[];
  d: number[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[];
  times: number[];
}

function study(inputs: Partial<CycleLowRsiStochRsiInputs>): BarStudy<CycleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: CycleRun = {
        rsiStep: taStep.rsi(cfg.lenRsi), ll: new WindowExtreme(true, cfg.lenStoch), hh: new WindowExtreme(false, cfg.lenStoch),
        kSma: new WindowSma(cfg.stochK), dSma: new WindowSma(cfg.stochD), rsiCross: taStep.crossover(),
        stCross: taStep.crossover(), rsi: [], k: [], d: [], plot0: [], markers: [], flags: [], times: [],
        steps: [], vars: { barsRsi: NaN, barsSt: NaN, anchorPriceDetected: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsiStep, s.ll, s.hh, s.kSma, s.dSma, s.rsiCross, s.stCross];
      s.lists = [s.markers, s.times];
      s.series = [s.rsi, s.k, s.d, s.plot0, s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // RSI and StochRSI
      const r = s.rsiStep.step(value(b));
      s.rsi[i] = r;
      const ll = s.ll.step(r);
      const hh = s.hh.step(r);
      // stoch_raw = (hh == ll) ? 50 : (rsi - ll) / (hh - ll) * 100
      const stochRaw = eq(hh, ll) ? 50 : ((r - ll) / (hh - ll)) * 100;
      const k = s.kSma.step(stochRaw);
      const d = s.dSma.step(k);
      s.k[i] = k;
      s.d[i] = d;

      // Events: ta.crossover compares exactly; ta.barssince of each
      const rsiCrossUp = s.rsiCross.step(r, cfg.rsiOs);
      const stCrossUp = s.stCross.step(k, d);
      if (rsiCrossUp) v.barsRsi = 0;
      else if (!isNaN(v.barsRsi)) v.barsRsi++;
      if (stCrossUp) v.barsSt = 0;
      else if (!isNaN(v.barsSt)) v.barsSt++;
      const nzRsi = isNaN(v.barsRsi) ? 1e6 : v.barsRsi;
      const nzSt = isNaN(v.barsSt) ? 1e6 : v.barsSt;
      const crossOk = cfg.oneBarTolerance ? nzRsi <= 1 && nzSt <= 1 : nzRsi === 0 && nzSt === 0;

      // rsi_prev_os = rsi[1] < rsi_os; st_prev_os = math.min(k[1], d[1]) < stoch_os (na compares false)
      const rsiPrevOs = i > 0 && lt(s.rsi[i - 1], cfg.rsiOs);
      const stPrevOs = i > 0 && lt(Math.min(s.k[i - 1], s.d[i - 1]), cfg.stochOs);
      const prevOk = cfg.requirePrevOS ? rsiPrevOs || stPrevOs : true;
      const strictOk = rsiPrevOs && stPrevOs;
      const score = (rsiCrossUp ? 1 : 0) + (stCrossUp ? 1 : 0) + (rsiPrevOs ? 1 : 0) + (stPrevOs ? 1 : 0);
      const oscOk = crossOk && (cfg.strictMode ? strictOk : prevOk) && score >= cfg.scoreThreshold;

      // if (time == anchor_time): anchor_price_detected := close (bar open time in Unix ms)
      if (b.time * 1000 === cfg.anchorTime) v.anchorPriceDetected = b.close;
      const finalAnchorPrice = cfg.useManualAnchorPrice ? cfg.anchorPriceManual : v.anchorPriceDetected;
      let projLevel = NaN;
      if (cfg.useAnchor && !isNaN(finalAnchorPrice)) projLevel = finalAnchorPrice * cfg.anchorMult;
      // near_anchor: not na(proj_level) and proj_level != 0 and |close - proj| / |proj| <= anchor_tol
      const nearAnchor = cfg.useAnchor
        ? !isNaN(projLevel) && !eq(projLevel, 0) && le(Math.abs(b.close - projLevel) / Math.abs(projLevel), cfg.anchorTol)
        : true;

      const cycleLow = oscOk && nearAnchor;
      s.flags[i] = cycleLow;
      if (cycleLow) s.times.push(b.time as number);
      // plotshape(plot_labels and cycleLow, shape.triangleup, size.small, color.lime, location.belowbar, text = "CL")
      if (cfg.plotLabels && cycleLow) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'small', text: 'CL', textColor: '#2962FF' });
      }
      s.plot0[i] = { time: b.time, value: cfg.useAnchor && !isNaN(projLevel) ? projLevel : NaN, color: color.gray };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        // alertcondition(cycleLow, "Cycle Low", "Cycle Low on {{ticker}} {{interval}}")
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.flags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CycleLowRsiStochRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CycleLowRsiStochRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cycle Low', message: 'Cycle Low on {{ticker}} {{interval}}' },
];

export const CycleLowRsiStochRsi = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
