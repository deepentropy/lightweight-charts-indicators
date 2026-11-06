/**
 * Price Linear Sequence Counter
 *
 * Counts the bars in a row where Series B is above Series A (difference > 0; +1 per bar) and the bars in a row where
 * it is below (difference < 0; -1 per bar); a bar that breaks the run resets the count to 0. Both counts are drawn as
 * columns. Two lines keep the highest positive count and the lowest negative count reached so far.
 *
 * Reference: "Price Linear Sequence Counter" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceLinearSequenceCounterInputs {
  /** Length (declared in the Pine script, not used by its computation) */
  length: number;
  /** Series A */
  sa: SourceType;
  /** Series B */
  sb: SourceType;
}

export const defaultInputs: PriceLinearSequenceCounterInputs = {
  length: 24,
  sa: 'open',
  sb: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length:', defval: 24 },
  { id: 'sa', type: 'source', title: 'Series A:', defval: 'open' },
  { id: 'sb', type: 'source', title: 'Series B:', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PLS', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'NLS', color: color.red, lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'PL', color: color.black, lineWidth: 1 },
  { id: 'plot3', title: 'NL', color: color.black, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Linear Sequence Counter',
  shortTitle: 'PLSC',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color: string };

interface PlscVars {
  prevPls: number;
  prevNls: number;
  prevPl: number;
  prevNl: number;
}

interface PlscRun extends BarRunState<PlscVars> {
  pls: Point[];
  nls: Point[];
  pl: Point[];
  nl: Point[];
}

function study(inputs: Partial<PriceLinearSequenceCounterInputs>): BarStudy<PlscRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const sa = barSource(cfg.sa);
  const sb = barSource(cfg.sb);
  return {
    fullRunReason: () => (isBarSource(cfg.sa) && isBarSource(cfg.sb) ? null : 'source of another study'),
    init() {
      const s: PlscRun = {
        pls: [], nls: [], pl: [], nl: [], steps: [], lists: [], series: [],
        vars: { prevPls: NaN, prevNls: NaN, prevPl: NaN, prevNl: NaN },
      };
      s.series = [s.pls, s.nls, s.pl, s.nl];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const v = s.vars;
      const difrange = sb(bar) - sa(bar);
      const posdifrange = ge(difrange, 0) ? difrange : 0;
      const negdifrange = le(difrange, 0) ? difrange : 0;
      // poslinearsequence := posdifrange > 0 ? nz(poslinearsequence[1]) + 1 : 0
      const p = gt(posdifrange, 0) ? nz(v.prevPls) + 1 : 0;
      // neglinearsequence := negdifrange < 0 ? nz(neglinearsequence[1]) - 1 : 0
      const q = lt(negdifrange, 0) ? nz(v.prevNls) - 1 : 0;
      // plinappex := nz(plinappex[1]) <= poslinearsequence ? poslinearsequence : nz(plinappex[1])
      const a = le(nz(v.prevPl), p) ? p : nz(v.prevPl);
      // nlinappex := nz(nlinappex[1]) >= neglinearsequence ? neglinearsequence : nz(nlinappex[1])
      const b = ge(nz(v.prevNl), q) ? q : nz(v.prevNl);
      s.pls[i] = { time: bar.time as number, value: p, color: color.green };
      s.nls[i] = { time: bar.time as number, value: q, color: color.red };
      s.pl[i] = { time: bar.time as number, value: a, color: color.black };
      s.nl[i] = { time: bar.time as number, value: b, color: color.black };
      v.prevPls = p;
      v.prevNls = q;
      v.prevPl = a;
      v.prevNl = b;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.pls.slice(),
          plot1: s.nls.slice(),
          plot2: s.pl.slice(),
          plot3: s.nl.slice(),
        },
        // hline(0, '0', color.black): Pine default style dashed
        hlines: [{ value: 0, options: { title: '0', color: color.black, linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceLinearSequenceCounterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceLinearSequenceCounterInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceLinearSequenceCounter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
