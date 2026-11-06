/**
 * Uptrick: Multi Moving Averages
 *
 * Up to three chained smoothing steps of the close: each enabled step applies one of 29 moving averages / filters
 * (SMA, EMA, WMA, RMA, LWMA, SMMA, HMA, TMA, DEMA, TEMA, KAMA, VIDYA, LSMA, GMA, ALMA, ZLEMA, FRAMA, VWMA, JMA,
 * EWMA, CFMA, BWMA, FIRMA, ITL, SSMA, MGD, DMA, PRMA, EAMA, in the simplified forms of the script) to the result of
 * the previous step. The final line and the bars are green when the line rises, red otherwise.
 *
 * Reference: "Uptrick: Multi Moving Averages" by Uptrick
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uptrick
 */

import { taStep, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { AlmaStep, createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export const MA_TYPES = [
  'SMA', 'EMA', 'WMA', 'RMA', 'LWMA', 'SMMA', 'HMA', 'TMA', 'DEMA', 'TEMA', 'KAMA',
  'VIDYA', 'LSMA', 'GMA', 'ALMA', 'ZLEMA', 'FRAMA', 'VWMA', 'JMA', 'EWMA', 'CFMA',
  'BWMA', 'FIRMA', 'ITL', 'SSMA', 'MGD', 'DMA', 'PRMA', 'EAMA',
] as const;

export type UptrickMaType = (typeof MA_TYPES)[number];

export interface UptrickMultiMaVolumeInputs {
  useS1: boolean;
  maType1: UptrickMaType;
  len1: number;
  useS2: boolean;
  maType2: UptrickMaType;
  len2: number;
  useS3: boolean;
  maType3: UptrickMaType;
  len3: number;
}

export const defaultInputs: UptrickMultiMaVolumeInputs = {
  useS1: true,
  maType1: 'EMA',
  len1: 9,
  useS2: false,
  maType2: 'EMA',
  len2: 9,
  useS3: false,
  maType3: 'EMA',
  len3: 9,
};

const options = [...MA_TYPES];

export const inputConfig: InputConfig[] = [
  { id: 'useS1', type: 'bool', title: 'Enable Smoothing #1', defval: true, group: 'Smoothing #1' },
  { id: 'maType1', type: 'string', title: 'Type #1', defval: 'EMA', options, group: 'Smoothing #1' },
  { id: 'len1', type: 'int', title: 'Length #1', defval: 9, min: 1, group: 'Smoothing #1' },
  { id: 'useS2', type: 'bool', title: 'Enable Smoothing #2', defval: false, group: 'Smoothing #2' },
  { id: 'maType2', type: 'string', title: 'Type #2', defval: 'EMA', options, group: 'Smoothing #2' },
  { id: 'len2', type: 'int', title: 'Length #2', defval: 9, min: 1, group: 'Smoothing #2' },
  { id: 'useS3', type: 'bool', title: 'Enable Smoothing #3', defval: false, group: 'Smoothing #3' },
  { id: 'maType3', type: 'string', title: 'Type #3', defval: 'EMA', options, group: 'Smoothing #3' },
  { id: 'len3', type: 'int', title: 'Length #3', defval: 9, min: 1, group: 'Smoothing #3' },
];

const UP_COLOR = color.rgb(0, 255, 150);
const DOWN_COLOR = color.rgb(255, 0, 0);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Final MA (3x)', color: UP_COLOR, lineWidth: 4 },
];

export const metadata = {
  title: 'Uptrick: Multi Moving Averages',
  shortTitle: '3x_MA_Smoothing',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
/** Pine nz: na and +-infinity give the replacement */
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

/** The values of one series by bar: the committed ones, then the one of the bar being calculated */
class History implements Committable {
  private vals: number[] = [];
  /** Committed bars */
  private count = 0;

  set(v: number): void {
    this.vals[this.count] = v;
  }

  /** x[k] on the bar being calculated (na before the first bar) */
  at(k: number): number {
    const j = this.count - k;
    return j >= 0 ? this.vals[j]! : NaN;
  }

  commit(): void {
    if (this.vals.length > this.count) this.count++;
  }
}

/** One smoothing step stepped bar by bar */
interface MaStep extends Committable {
  step(x: number, vol: number): number;
}

/** A step from its function of the bar and the machines it commits */
function machine(step: (x: number, vol: number) => number, parts: Committable[]): MaStep {
  return { step, commit: () => { for (const p of parts) p.commit(); } };
}

/** One smoothing step (f_getMA) on the values x (NaN = na), one bar at a time */
function getMa(length: number, type: string, n: number): MaStep {
  /** var float y := nz(y[1]) + alpha * (x - nz(y[1])) */
  const recursive = (alpha: (xh: History) => number): MaStep => {
    const xh = new History();
    const yh = new History();
    return machine((x) => {
      xh.set(x);
      const p = nz(yh.at(1));
      const y = p + alpha(xh) * (x - p);
      yh.set(y);
      return y;
    }, [xh, yh]);
  };
  /** Efficiency ratio of KAMA / VIDYA */
  const efficiency = (xh: History) => {
    let v = 0.0;
    for (let k = 1; k <= length; k++) v += Math.abs(xh.at(k) - xh.at(k - 1));
    const dir = Math.abs(xh.at(0) - nz(xh.at(length)));
    return eq(v, 0) ? 1.0 : dir / v;
  };
  const ema = () => taStep.ema(length);

  switch (type) {
    case 'SMA': {
      const m = new WindowSma(length);
      return machine((x) => m.step(x), [m]);
    }
    case 'EMA':
    case 'EWMA': {
      const m = ema();
      return machine((x) => m.step(x), [m]);
    }
    case 'WMA': {
      const m = taStep.wma();
      return machine((x) => m.step(x, length), [m]);
    }
    case 'RMA':
    case 'SMMA': {
      const m = taStep.rma(length);
      return machine((x) => m.step(x), [m]);
    }
    case 'LWMA': {
      const xh = new History();
      return machine((x) => {
        xh.set(x);
        let sum = 0.0;
        let sumWeight = 0.0;
        for (let k = 0; k <= length - 1; k++) {
          const w = k + 1;
          sum += xh.at(k) * w;
          sumWeight += w;
        }
        return ne(sumWeight, 0) ? sum / sumWeight : x;
      }, [xh]);
    }
    case 'HMA': {
      const halfLen = Math.floor(length / 2);
      const sqrtLen = Math.floor(Math.sqrt(length));
      const w1 = taStep.wma();
      const w2 = taStep.wma();
      const w3 = taStep.wma();
      const lengthError = () => new Error(`Error on bar 0: Invalid value of the 'length' argument (${halfLen.toFixed(1)}) in the 'wma' function. It must be > 0.`);
      // Pine runtime error of ta.wma(_src, 0) (length 1), before the next steps
      if (n > 0 && halfLen <= 0) throw lengthError();
      return machine((x) => {
        if (halfLen <= 0) throw lengthError();
        return w3.step(2.0 * w1.step(x, halfLen) - w2.step(x, length), sqrtLen);
      }, [w1, w2, w3]);
    }
    case 'TMA': {
      const a = new WindowSma(length);
      const b = new WindowSma(length);
      return machine((x) => b.step(a.step(x)), [a, b]);
    }
    case 'DEMA': {
      const e1 = ema();
      const e2 = ema();
      return machine((x) => {
        const ema1 = e1.step(x);
        return 2.0 * ema1 - e2.step(ema1);
      }, [e1, e2]);
    }
    case 'TEMA': {
      const e1 = ema();
      const e2 = ema();
      const e3 = ema();
      return machine((x) => {
        const ema1 = e1.step(x);
        const ema2 = e2.step(ema1);
        return 3.0 * (ema1 - ema2) + e3.step(ema2);
      }, [e1, e2, e3]);
    }
    case 'KAMA':
    case 'VIDYA': {
      const fastSC = 2.0 / (2 + 1);
      const slowSC = 2.0 / (30 + 1);
      return recursive((xh) => {
        const base = efficiency(xh) * (fastSC - slowSC) + slowSC;
        return type === 'KAMA' ? math.pow(base, 2) : base;
      });
    }
    case 'LSMA':
    case 'PRMA': {
      const m = taStep.linreg(length, 0);
      return machine((x) => m.step(x), [m]);
    }
    case 'GMA': {
      const xh = new History();
      return machine((x) => {
        xh.set(x);
        let sumLog = 0.0;
        for (let k = 0; k <= length - 1; k++) sumLog += math.log(nz(xh.at(k)));
        return math.exp(sumLog / length);
      }, [xh]);
    }
    case 'ALMA': {
      const m = new AlmaStep(length, 0.85, 6);
      return machine((x) => m.step(x), [m]);
    }
    case 'ZLEMA': {
      const lag = Math.floor((length - 1) * 0.5);
      const xh = new History();
      const m = ema();
      return machine((x) => {
        xh.set(x);
        return m.step(x + (x - nz(xh.at(lag), x)));
      }, [xh, m]);
    }
    case 'FRAMA': {
      const len = Math.max(length, 1);
      const hh = new WindowExtreme(false, len);
      const ll = new WindowExtreme(true, len);
      const yh = new History();
      return machine((x) => {
        const range1 = hh.step(x) - ll.step(x);
        const dim = eq(range1, 0.0) ? 1.0 : math.log10(range1 / len) / math.log10(2);
        const alpha = math.exp(-4.6 * (dim - 1));
        const p = nz(yh.at(1));
        const y = p + alpha * (x - p);
        yh.set(y);
        return y;
      }, [hh, ll, yh]);
    }
    case 'VWMA': {
      const xh = new History();
      const vh = new History();
      return machine((x, vol) => {
        xh.set(x);
        vh.set(vol);
        let sumPV = 0.0;
        let sumVol = 0.0;
        for (let k = 0; k <= length - 1; k++) {
          sumPV += xh.at(k) * vh.at(k);
          sumVol += vh.at(k);
        }
        return ne(sumVol, 0) ? sumPV / sumVol : x;
      }, [xh, vh]);
    }
    case 'JMA': {
      const beta = (0.45 * (length - 1)) / (0.45 * (length - 1) + 2.0);
      return recursive(() => beta);
    }
    case 'CFMA': {
      const m = taStep.linreg(length, 0);
      const xh = new History();
      return machine((x) => {
        xh.set(x);
        return m.step(x) + (x - nz(xh.at(1)));
      }, [m, xh]);
    }
    case 'BWMA':
    case 'SSMA': {
      // 2-pole filter of BWMA / SSMA (bwPrev := nz(bwPrev[1], src))
      const a = math.exp((-1.414 * 3.14159) / length);
      const ph = new History();
      return machine((x) => {
        const p1 = ph.at(1);
        const prev = nz(p1, x);
        ph.set(prev);
        return (1 - a) * (1 - a) * x + 2 * a * prev - a * a * nz(p1);
      }, [ph]);
    }
    case 'FIRMA': {
      const xh = new History();
      return machine((x) => {
        xh.set(x);
        let sum = 0.0;
        for (let k = 0; k <= length - 1; k++) sum += xh.at(k);
        return sum / length;
      }, [xh]);
    }
    case 'ITL': {
      const xh = new History();
      const yh = new History();
      return machine((x) => {
        xh.set(x);
        const y = 0.5 * ((x + nz(xh.at(1))) / 2) + 0.5 * nz(yh.at(1));
        yh.set(y);
        return y;
      }, [xh, yh]);
    }
    case 'MGD': {
      const speed = 0.6;
      const yh = new History();
      return machine((x) => {
        const p = nz(yh.at(1));
        // src / 0 is +-infinity: the step is 0 (Pine float division)
        const y = p + (x - p) / (speed * math.pow(x / p, 4));
        yh.set(y);
        return y;
      }, [yh]);
    }
    case 'DMA': {
      const alpha = (2 * 3.14159) / length;
      const xh = new History();
      const hh = new History();
      return machine((x) => {
        xh.set(x);
        const hp = math.pow(1 - alpha / 2, 2) * (x - 2 * nz(xh.at(1)) + nz(xh.at(2)))
          + 2 * (1 - alpha) * nz(hh.at(1)) - math.pow(1 - alpha, 2) * nz(hh.at(2));
        hh.set(hp);
        return x - hp;
      }, [xh, hh]);
    }
    case 'EAMA':
      return recursive(() => 0.07);
    default:
      return machine((x) => x, []);
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface UptrickRun extends BarRunState<{ prevFinal: number }> {
  mas: MaStep[];
  plot0: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<UptrickMultiMaVolumeInputs>): BarStudy<UptrickRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init(bars) {
      const n = bars.length;
      const mas: MaStep[] = [];
      if (cfg.useS1) mas.push(getMa(cfg.len1, cfg.maType1, n));
      if (cfg.useS2) mas.push(getMa(cfg.len2, cfg.maType2, n));
      if (cfg.useS3) mas.push(getMa(cfg.len3, cfg.maType3, n));
      const s: UptrickRun = { mas, plot0: [], barColors: [], steps: mas, vars: { prevFinal: NaN }, lists: [], series: [] };
      s.series = [s.plot0, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      // ma1 = useS1 ? f_getMA(close) : close, ma2 = useS2 ? f_getMA(ma1) : ma1, finalMA = useS3 ? f_getMA(ma2) : ma2
      let v = b.close;
      for (const m of s.mas) v = m.step(v, vol);
      // finalMA > finalMA[1] (an infinite value compares, na does not)
      const slopeColor = i > 0 && gt(v, s.vars.prevFinal) ? UP_COLOR : DOWN_COLOR;
      s.vars.prevFinal = v;
      s.plot0[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN, color: slopeColor };
      s.barColors[i] = { time: b.time, color: slopeColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UptrickMultiMaVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UptrickMultiMaVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const UptrickMultiMaVolume = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
