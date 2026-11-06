/**
 * Gideons Gold - ADX Watchman
 *
 * Average Directional Index drawn as columns: +DI / -DI = fixnan(100 * rma(+DM / -DM, DI length) / rma(true range,
 * DI length)), ADX = 100 * rma(|+DI - -DI| / (+DI + -DI, 1 when the sum is 0), ADX smoothing). The columns are red
 * at or below 20, yellow below 22 and green otherwise.
 *
 * Reference: "Gideons Gold — ADX Watchman" by gideonsgold
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GideonsGoldAdxWatchmanInputs {
  /** ADX smoothing length */
  adxlen: number;
  /** DI length */
  dilen: number;
}

export const defaultInputs: GideonsGoldAdxWatchmanInputs = {
  adxlen: 14,
  dilen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxlen', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'dilen', type: 'int', title: 'DI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX Histogram', color: color.green, lineWidth: 2, style: 'columns' },
];

export const metadata = {
  title: 'Gideons Gold — ADX Watchman',
  shortTitle: 'Gideons Gold — ADX Watchman',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface AdxRun extends BarRunState<{ plus: number; minus: number }> {
  tr: ReturnType<typeof taStep.tr>;
  truerange: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adx: ReturnType<typeof taStep.rma>;
  plot0: Point[];
}

function study(inputs: Partial<GideonsGoldAdxWatchmanInputs>): BarStudy<AdxRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const tr = taStep.tr(false); // ta.tr: na on the first bar
      const truerange = taStep.rma(cfg.dilen);
      const plusRma = taStep.rma(cfg.dilen);
      const minusRma = taStep.rma(cfg.dilen);
      const adx = taStep.rma(cfg.adxlen);
      const s: AdxRun = {
        tr, truerange, plusRma, minusRma, adx, plot0: [],
        steps: [tr, truerange, plusRma, minusRma, adx], vars: { plus: NaN, minus: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // dirmov(dilen)
      const up = i > 0 ? b.high - bars[i - 1].high : NaN; // ta.change(high)
      const down = i > 0 ? -(b.low - bars[i - 1].low) : NaN; // -ta.change(low)
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const truerange = s.truerange.step(s.tr.step(b.high, b.low, b.close));
      const plusRma = s.plusRma.step(plusDM);
      const minusRma = s.minusRma.step(minusDM);
      // A plain division: x / 0 is +-infinity (fixnan keeps it), 0 / 0 is na (fixnan replaces it)
      const pv = (100 * plusRma) / truerange;
      const mv = (100 * minusRma) / truerange;
      const v = s.vars;
      if (!Number.isNaN(pv)) v.plus = pv;
      if (!Number.isNaN(mv)) v.minus = mv;
      const plus = v.plus;
      const minus = v.minus;

      // adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), adxlen)
      const sum = plus + minus;
      const x = Math.abs(plus - minus) / (eq(sum, 0) ? 1 : sum);
      const sig = 100 * s.adx.step(x);

      // histColor = sig <= 20 ? color.red : sig < 22 ? color.yellow : color.green
      s.plot0[i] = {
        time: b.time as number,
        value: Number.isFinite(sig) ? sig : NaN,
        color: le(sig, 20) ? color.red : lt(sig, 22) ? color.yellow : color.green,
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GideonsGoldAdxWatchmanInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GideonsGoldAdxWatchmanInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GideonsGoldAdxWatchman = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
