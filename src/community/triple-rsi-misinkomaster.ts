/**
 * Triple RSI
 *
 * Three RSIs of the source, centred on 0 (RSI - 50), with lengths round(sqrt(len)), round(len / 2) and len:
 * TRSI = RSI(sqrt) + RSI(half) - RSI(len), smoothed with an RMA of half length, an RMA of sqrt length and an HMA of
 * sqrt length. The line and the fill to zero are green while TRSI > 0 and red while TRSI < 0 (the last colour is
 * kept at 0). The trend turns up when TRSI crosses over 0 and down when it crosses under 0; the background of the
 * indicator pane and of the price pane is coloured with the line colour on the bars where the trend changes.
 *
 * Reference: "Triple RSI | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import {
  taStep, getSourceSeries, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TripleRsiMisinkoMasterInputs {
  /** TRSI length */
  len: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: TripleRsiMisinkoMasterInputs = {
  len: 30,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'TRSI Length', defval: 30, min: 3, step: 1, group: 'TRSI', tooltip: 'Changes the length of the TRSI' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'TRSI' },
];

const COL_UP = String(color.rgb(0, 255, 0, 0));
const COL_DOWN = String(color.rgb(255, 0, 0, 0));
const FILL_UP = String(color.rgb(0, 222, 0, 65));
const FILL_DOWN = String(color.rgb(222, 0, 0, 65));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRSI', color: color.white, lineWidth: 3 },
  { id: 'plot1', title: 'Zero Line', color: color.white, lineWidth: 2, display: 'pane' },
];

export const metadata = {
  title: 'Triple RSI | MisinkoMaster',
  shortTitle: 'TRSI | MisinkoMaster',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Point = { time: number; value: number; color: string };

interface TripleRsiVars {
  trend: number;
  col: string;
  colT: string;
  /** trsi of the bar before */
  trsi1: number;
}

interface TripleRsiRun extends BarRunState<TripleRsiVars> {
  rsi1: ReturnType<typeof taStep.rsi>;
  rsi2: ReturnType<typeof taStep.rsi>;
  rsi3: ReturnType<typeof taStep.rsi>;
  rma1: ReturnType<typeof taStep.rma>;
  rma2: ReturnType<typeof taStep.rma>;
  hma: ReturnType<typeof taStep.hma>;
  ext: number[] | null;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<TripleRsiMisinkoMasterInputs>): BarStudy<TripleRsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const barValue = barSource(cfg.src);
  // halflen = math.abs(math.round(len / 2)); sqrtlen = math.abs(math.round(math.sqrt(len)))
  const halflen = Math.abs(Math.round(cfg.len / 2));
  const sqrtlen = Math.abs(Math.round(Math.sqrt(cfg.len)));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(bars) {
      const rsi1 = taStep.rsi(sqrtlen);
      const rsi2 = taStep.rsi(halflen);
      const rsi3 = taStep.rsi(cfg.len);
      const rma1 = taStep.rma(halflen);
      const rma2 = taStep.rma(sqrtlen);
      const hma = taStep.hma(sqrtlen);
      const s: TripleRsiRun = {
        rsi1, rsi2, rsi3, rma1, rma2, hma,
        ext: isBarSource(cfg.src) ? null : getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN),
        plot0: [], plot1: [], fillColors: [], bgColors: [],
        steps: [rsi1, rsi2, rsi3, rma1, rma2, hma],
        // var trend = 0; var col = color.white; var colT = color.white
        vars: { trend: 0, col: color.white, colT: color.white, trsi1: NaN },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const src = s.ext ? s.ext[i] : barValue(b);
      // trsi = (rsi1 - 50) + (rsi2 - 50) - (rsi3 - 50), then rma(halflen), rma(sqrtlen), hma(sqrtlen)
      const raw = (s.rsi1.step(src) - 50) + (s.rsi2.step(src) - 50) - (s.rsi3.step(src) - 50);
      const trsi = s.hma.step(s.rma2.step(s.rma1.step(raw)));
      const prevTrend = v.trend;
      // L = ta.crossover(trsi, 0); S = ta.crossunder(trsi, 0): exact comparisons
      const prev = i > 0 ? v.trsi1 : NaN;
      const L = trsi > 0 && prev <= 0;
      const Sx = trsi < 0 && prev >= 0;
      if (L && !Sx) v.trend = 1;
      if (Sx) v.trend = -1;
      if (gt(trsi, 0)) {
        v.col = COL_UP;
        v.colT = FILL_UP;
      }
      if (lt(trsi, 0)) {
        v.col = COL_DOWN;
        v.colT = FILL_DOWN;
      }
      s.plot0[i] = { time: b.time, value: trsi, color: v.col };
      s.plot1[i] = { time: b.time, value: 0, color: color.white };
      s.fillColors[i] = v.colT;
      // bgcolor(trend != trend[1] ? col : na), once in the pane and once with force_overlay (trend[1] is na on bar 0)
      if (i > 0 && v.trend !== prevTrend) {
        s.bgColors.push({ id: 'bgcolor0', time: b.time, color: v.col });
        s.bgColors.push({ id: 'bgcolor1', time: b.time, color: v.col, forceOverlay: true });
      }
      v.trsi1 = trsi;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // fill(trsip, t, color = colT)
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TripleRsiMisinkoMasterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TripleRsiMisinkoMasterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TripleRsiMisinkoMaster = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
