/**
 * Bernoulli Process - Binary Entropy Function
 *
 * A measurement of the close (and optionally of log(volume)) over `len` bars (value, SMA, change, momentum,
 * acceleration, contribution, %-change, log volatility or Ehlers UltimateSmoother) is ranked over `avg` bars; its
 * percent rank r gives the binary entropy term r * log2(r) - (1 - r) * log2(1 - r), summed over `len` bars.
 * "Bernoulli Purest" first passes the measurement through a normal CDF. The columns are coloured by the trade band,
 * with darker colours when the percent rank of the result is extreme and an OBV based DI difference disagrees.
 * Triangles mark the extreme percent ranks.
 * Alerts (alertcondition, `alerts` of the result): 'Alert on Down Triangle' (the percent rank crosses above
 * 100 - limit) and 'Alert on Up Triangle' (it crosses below the limit).
 *
 * Reference: "Bernoulli Process - Binary Entropy Function" by kocurekc
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type Committable, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

const TYPES = ['Value', 'SMA', 'Change', '%-Change', 'Momentum', 'Acceleration', 'Contribution', 'Volatility',
  'Elher_smoother'] as const;
type MeasureType = typeof TYPES[number];

export interface BernoulliProcessEntropyInputs {
  /** Entropy length */
  len: number;
  /** Trade band (confirmation) */
  trange: number;
  /** Averaging (percent rank) length */
  avg: number;
  /** Measurement type */
  type: MeasureType;
  /** ADX-DI length */
  diLen: number;
  /** Percent rank limit */
  vPR: number;
  /** Include the close */
  bc: boolean;
  /** Include the volume */
  vc: boolean;
  /** Print the price and volume bands */
  pb: boolean;
  /** Print the OBV-ADX DI difference when it moves opposite to the Bernoulli value */
  pobv: boolean;
  /** Extra highlighting */
  xc: boolean;
  /** Bernoulli Purest: measurement through a normal CDF */
  xn: boolean;
  /** CDF smoother */
  smo: number;
}

export const defaultInputs: BernoulliProcessEntropyInputs = {
  len: 22,
  trange: 0.67,
  avg: 88,
  type: 'Contribution',
  diLen: 11,
  vPR: 5,
  bc: true,
  vc: false,
  pb: false,
  pobv: false,
  xc: true,
  xn: false,
  smo: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Entropy Length', defval: 22 },
  { id: 'trange', type: 'float', title: 'Trade Band - confirmation', defval: 0.67 },
  { id: 'avg', type: 'int', title: 'Averaging Length', defval: 88 },
  { id: 'type', type: 'string', title: 'Measurement Type', defval: 'Contribution', options: [...TYPES] },
  { id: 'diLen', type: 'int', title: 'ADX-DI Length', defval: 11 },
  { id: 'vPR', type: 'int', title: 'Percent Rank Limit', defval: 5 },
  { id: 'bc', type: 'bool', title: 'Include Source', defval: true },
  { id: 'vc', type: 'bool', title: 'Include Volume', defval: false },
  { id: 'pb', type: 'bool', title: 'Print Bands', defval: false },
  { id: 'pobv', type: 'bool', title: 'Print OBV-ADX', defval: false },
  { id: 'xc', type: 'bool', title: 'Extra Highlighting', defval: true },
  { id: 'xn', type: 'bool', title: 'Bernoulli Purest', defval: false },
  { id: 'smo', type: 'int', title: 'Probability Smoother', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI Difference', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Bernoulli', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'price', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'volume', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Bernoulli - V3',
  shortTitle: 'Bernoulli',
  overlay: false,
};

type Arr = number[];
type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
/** One bar of a source: its value on bar i (the earlier values kept in arrays of the run) */
type BarFn = (v: number, i: number) => number;

/** ta.percentrank(source, length) on bar i of `src` (the values of every bar): the oakscriptjs array function */
function percentrankAt(src: Arr, i: number, length: number): number {
  if (i < length) return NaN;
  const cur = src[i];
  let count = 0;
  for (let j = 1; j <= length; j++) if (compare.le(src[i - j], cur)) count++;
  return (count * 100) / length;
}

interface BernVars {
  /** fixnan(100 * ema(plusDM) / trur), fixnan(100 * ema(minusDM) / trur): the last non-na values */
  plus: number;
  minus: number;
}

interface BernRun extends BarRunState<BernVars> {
  /** infoc / infov of one bar: the measurement chain of the close / log(volume) (null when not included) */
  cr: BarFn | null;
  vr: BarFn | null;
  info2: number[];
  obv: ReturnType<typeof taStep.obv>;
  obvChange: ReturnType<typeof taStep.change>;
  obvDev: ReturnType<typeof taStep.stdev>;
  trur: ReturnType<typeof taStep.rma>;
  emaP: ReturnType<typeof taStep.ema>;
  emaM: ReturnType<typeof taStep.ema>;
  hvp: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BernoulliProcessEntropyInputs>): BarStudy<BernRun, Result> {
  const { len, trange, avg, type, diLen, vPR, bc, vc, pb, pobv, xc, xn, smo } = { ...defaultInputs, ...inputs };
  const back = (a: Arr, i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);
  const nz = (v: number, r = 0) => (isNaN(v) ? r : v);
  const red50 = String(color.new(color.red, 50));
  const green50 = String(color.new(color.green, 50));
  const bands = pb && bc && vc && !xn;

  /** measure(_type, _src, _lbl) of one source: its machines added to `steps`, its arrays of every bar to `series` */
  const measure = (steps: Committable[], series: unknown[][], lbl: number): BarFn => {
    const src: Arr = [];
    series.push(src);
    const add = <T extends Committable>(m: T): T => { steps.push(m); return m; };
    const keep = (f: BarFn): BarFn => (v, i) => { src[i] = v; return f(v, i); };
    switch (type) {
      case 'Value': return (v) => v;
      case 'SMA': { const sma = add(taStep.sma()); return (v) => sma.step(v, lbl); }
      case 'Change': {
        const ch = add(taStep.change(1)); const sma = add(taStep.sma());
        return (v) => sma.step(ch.step(v), lbl);
      }
      case 'Momentum': {
        const ch = add(taStep.change(lbl)); const sma = add(taStep.sma());
        return (v) => sma.step(ch.step(v), lbl);
      }
      case 'Acceleration': {
        const ch = add(taStep.change(lbl)); const ch2 = add(taStep.change(lbl)); const sma = add(taStep.sma());
        return (v) => sma.step(ch2.step(ch.step(v)), lbl);
      }
      case 'Contribution': { const sum = add(taStep.sum()); return (v) => v / sum.step(v, lbl); }
      case '%-Change': {
        const ch = add(taStep.change(1)); const sma = add(taStep.sma());
        return keep((v, i) => sma.step(ch.step(v) / nz(back(src, i, lbl), v), lbl));
      }
      case 'Volatility': {
        const sma = add(taStep.sma()); const sum = add(taStep.sum());
        return keep((v, i) => {
          const vaa = Math.log(v / nz(back(src, i, 1), v));
          const vam = sma.step(vaa, lbl);
          return Math.sqrt(sum.step(Math.pow(vaa - vam, 2), lbl) / lbl);
        });
      }
      case 'Elher_smoother': {
        // Ehlers UltimateSmoother: us = src; from bar_index 4 on the 2-pole formula with us[1], us[2]
        const period = lbl;
        const a1 = Math.exp((-1.414 * Math.PI) / period);
        const c2 = 2.0 * a1 * Math.cos((1.414 * Math.PI) / period);
        const c3 = -a1 * a1;
        const c1 = (1.0 + c2 - c3) / 4.0;
        const us: Arr = [];
        series.push(us);
        return keep((v, i) => {
          us[i] = v;
          if (i >= 4) {
            us[i] = (1.0 - c1) * v + (2.0 * c1 - c2) * src[i - 1] - (c1 + c3) * src[i - 2]
              + c2 * nz(us[i - 1]) + c3 * nz(us[i - 2]);
          }
          return us[i];
        });
      }
      default: return () => 0;
    }
  };

  // n_CDF(_src, _len, _smo): normal CDF approximation of the z-score, smoothed
  const nCdf = (steps: Committable[], l: number, sm: number): ((v: number) => number) => {
    const xBarStep = taStep.sma(); const sum = taStep.sum(); const smooth = taStep.sma();
    steps.push(xBarStep, sum, smooth);
    return (v) => {
      const xBar = xBarStep.step(v, l);
      const sd = Math.sqrt(sum.step(Math.pow(v - xBar, 2), l) / (l - 1));
      const z = Math.max(Math.min((v - xBar) / sd, 5.55), -5.55);
      return smooth.step(1 / (1 + Math.pow(1 - z / 5.555, 1 / 0.1186)), sm);
    };
  };

  // bern(_src, _avg, _len, _xn): sum over _len bars of the binary entropy term of the clamped percent rank
  const bern = (steps: Committable[], series: unknown[][]): BarFn => {
    const sum = taStep.sum();
    const src: Arr = [];
    steps.push(sum);
    series.push(src);
    return (v, i) => {
      src[i] = v;
      const r2 = Math.min(Math.max(percentrankAt(src, i, avg) / 100, 0.001), 0.999);
      return sum.step(((xn ? -1 : 1) * r2 * Math.log(r2)) / Math.log(2) - ((1 - r2) * Math.log(1 - r2)) / Math.log(2), len);
    };
  };

  /** measure, then n_CDF with "Bernoulli Purest", then bern, of one source */
  const chain = (steps: Committable[], series: unknown[][]): BarFn => {
    const m = measure(steps, series, len);
    const cdf = xn ? nCdf(steps, len, smo) : null;
    const b = bern(steps, series);
    return (v, i) => { const x = m(v, i); return b(cdf ? cdf(x) : x, i); };
  };

  return {
    init() {
      const steps: Committable[] = [];
      const series: unknown[][] = [];
      const cr = bc ? chain(steps, series) : null;
      const vr = vc ? chain(steps, series) : null;
      const s: BernRun = {
        cr, vr, info2: [], obv: taStep.obv(), obvChange: taStep.change(1), obvDev: taStep.stdev(),
        trur: taStep.rma(diLen), emaP: taStep.ema(diLen), emaM: taStep.ema(diLen),
        hvp: [], plots: [[], [], [], []], markers: [], flags: [[], []], times: [[], []],
        steps, vars: { plus: NaN, minus: NaN }, lists: [], series,
      };
      steps.push(s.obv, s.obvChange, s.obvDev, s.trur, s.emaP, s.emaM);
      s.lists = [s.markers, ...s.times];
      series.push(s.info2, s.hvp, ...s.plots, ...s.flags);
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const vars = s.vars;
      const infoc = s.cr ? s.cr(b.close, i) : 0;
      const infov = s.vr ? s.vr(Math.log(b.volume ?? NaN), i) : 0;
      // info2 = bc and vc ? infoc - infov : xn ? (infoc + infov) / (-len + 1) : infoc + infov
      const v = bc && vc ? infoc - infov : xn ? (infoc + infov) / (-len + 1) : infoc + infov;
      s.info2[i] = v;
      const h = percentrankAt(s.info2, i, avg);
      s.hvp[i] = h;

      // obv_adx(_len, _lensig): DI difference of the OBV (true range replaced by RMA of the OBV stdev)
      const obv = s.obv.step(b.close, b.volume ?? NaN);
      const up = s.obvChange.step(obv);
      const down = -up;
      const plusDM = isNaN(up) ? NaN : up > down && up > 0 ? up : 0;
      const minusDM = isNaN(down) ? NaN : down > up && down > 0 ? down : 0;
      const trur = s.trur.step(s.obvDev.step(obv, diLen));
      const plusRaw = (100 * s.emaP.step(plusDM)) / trur;
      const minusRaw = (100 * s.emaM.step(minusDM)) / trur;
      // fixnan keeps the last non-na value (+/-Infinity kept)
      if (!Number.isNaN(plusRaw)) vars.plus = plusRaw;
      if (!Number.isNaN(minusRaw)) vars.minus = minusRaw;
      const diDiff = vars.plus - vars.minus;
      // diDiff2 = math.sign(info2) == math.sign(diDiff) ? 0 : diDiff
      const diDiff2 = Math.sign(v) === Math.sign(diDiff) ? 0 : diDiff;

      // col1 = info2 > trange ? green : info2 < -trange ? red : gray
      const col1 = v > trange ? color.green : v < -trange ? color.red : color.gray;
      // col2 adds maroon / lime when the percent rank is extreme and the DI difference disagrees
      const col2 = v > trange && h > 100 - vPR && diDiff2 !== 0 ? color.maroon
        : v < -trange && h < vPR && diDiff2 !== 0 ? color.lime
          : col1;
      const p = s.plots;
      p[0][i] = { time: t, value: pobv ? diDiff2 / 10 : NaN };
      p[1][i] = { time: t, value: v, color: xc ? col2 : col1 };
      p[2][i] = { time: t, value: bands ? infoc : NaN };
      p[3][i] = { time: t, value: bands ? -infov : NaN };
      const bigMove = Math.abs(v) > Math.abs(trange);
      // green_arrows: triangledown at info2 in red 50; red_arrows: triangleup at info2 in green 50
      if (h > 100 - vPR && bigMove && v >= trange) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: v, shape: 'triangleDown', color: red50, size: 'tiny' });
      }
      if (h < vPR && bigMove && v <= trange) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: v, shape: 'triangleUp', color: green50, size: 'tiny' });
      }
      // downAlert = hvp[1] < 100 - vPR and hvp > 100 - vPR; upAlert = hvp[1] > vPR and hvp < vPR
      const prev = i > 0 ? s.hvp[i - 1] : NaN;
      const down2 = prev < 100 - vPR && h > 100 - vPR;
      const up2 = prev > vPR && h < vPR;
      s.flags[0][i] = down2;
      s.flags[1][i] = up2;
      if (down2) s.times[0].push(t as number);
      if (up2) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BernoulliProcessEntropyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BernoulliProcessEntropyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert on Down Triangle', message: 'Bernoulli Down Triangle!' },
  { id: 'alert1', title: 'Alert on Up Triangle', message: 'Bernoulli Up Triangle!' },
];

export const BernoulliProcessEntropy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
