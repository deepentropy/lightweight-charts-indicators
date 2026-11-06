/**
 * Demand Index (Sibbet)
 *
 * HL2C = high + low + 2 * close. The volume is normalised by its EMA (Buy/Sell Power Length). On a falling HL2C the
 * buy power is volNorm / exp(0.375 * (HL2C + HL2C[1]) / |H0 - L0| * (HL2C[1] - HL2C) / HL2C), on a rising HL2C the
 * sell power is volNorm / exp(0.375 * (HL2C + HL2C[1]) / |H0 - L0| * (HL2C - HL2C[1]) / HL2C[1]) (H0 / L0: high
 * and low of the first bar); otherwise each power is volNorm. Both powers are smoothed by an EMA. Q is the smaller
 * power divided by the larger one, and the Demand Index is 100 * (1 - Q) when the buy power is the larger one, else
 * 100 * (Q - 1): green at or above 0, red below, with an SMA line.
 *
 * Reference: "Demand Index (James Sibbet)" by conair
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { WindowSma, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DemandIndexInputs {
  /** EMA length of the volume normalisation */
  bsLength: number;
  /** EMA length of the buy / sell powers */
  bsSmooth: number;
  /** SMA length of the Demand Index */
  diSmaLength: number;
  /** Show the SMA line */
  showDiSma: boolean;
}

export const defaultInputs: DemandIndexInputs = {
  bsLength: 10,
  bsSmooth: 10,
  diSmaLength: 10,
  showDiSma: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'bsLength', type: 'int', title: 'Buy/Sell Power Length (EMA)', defval: 10, min: 1 },
  { id: 'bsSmooth', type: 'int', title: 'Smooth Buy/Sell Power (EMA)', defval: 10, min: 1 },
  { id: 'diSmaLength', type: 'int', title: 'Smooth Demand Index (SMA)', defval: 10, min: 1 },
  { id: 'showDiSma', type: 'bool', title: 'Show DI SMA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: String(color.new(color.gray, 70)), lineWidth: 1 },
  { id: 'plot1', title: 'Demand Index', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'DI SMA', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Demand Index (Sibbet)',
  shortTitle: 'Demand Index (Sibbet)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max: na when an argument is na */
const max = (a: number, b: number) => Math.max(a, b);

type Point = { time: number; value: number; color: string };

interface DemandIndexVars {
  /** max(|H0 - L0|, 1e-10) of the first bar */
  denHL0: number;
  /** hl2c of the bar before */
  hl2c1: number;
}

interface DemandIndexRun extends BarRunState<DemandIndexVars> {
  emaVol: ReturnType<typeof taStep.ema>;
  bp: ReturnType<typeof taStep.ema>;
  sp: ReturnType<typeof taStep.ema>;
  diSma: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<DemandIndexInputs>): BarStudy<DemandIndexRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const zeroColor = String(color.new(color.gray, 70));
  const up = String(color.new(color.green, 0));
  const down = String(color.new(color.red, 0));
  const white = String(color.new(color.white, 0));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const emaVol = taStep.ema(cfg.bsLength);
      const bp = taStep.ema(cfg.bsSmooth);
      const sp = taStep.ema(cfg.bsSmooth);
      const diSma = new WindowSma(cfg.diSmaLength);
      const s: DemandIndexRun = {
        emaVol, bp, sp, diSma, plots: [[], [], []],
        steps: [emaVol, bp, sp, diSma],
        vars: { denHL0: NaN, hl2c1: NaN },
        lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // var H0 / L0: high / low of the first bar
      if (i === 0) v.denHL0 = max(Math.abs(b.high - b.low), EPS);
      const denHL0 = v.denHL0;
      // HL2C per Sibbet: H + L + 2C
      const cur = b.high + b.low + 2.0 * b.close;
      const volume = b.volume ?? NaN;
      const volNorm = volume / max(s.emaVol.step(volume), EPS);
      // hl2cPrev = nz(hl2c[1], hl2c)
      const prev = i > 0 && !isNaN(v.hl2c1) ? v.hl2c1 : cur;
      const bpExpArg = 0.375 * ((cur + prev) / denHL0) * ((prev - cur) / max(cur, EPS));
      const spExpArg = 0.375 * ((cur + prev) / denHL0) * ((cur - prev) / max(prev, EPS));
      const bpRaw = lt(cur, prev) ? volNorm / Math.exp(bpExpArg) : volNorm;
      const spRaw = gt(cur, prev) ? volNorm / Math.exp(spExpArg) : volNorm;
      v.hl2c1 = cur;

      const bp = s.bp.step(bpRaw);
      const sp = s.sp.step(spRaw);
      const greaterBP = gt(bp, sp);
      const equalBP = le(Math.abs(bp - sp), EPS);
      const q = greaterBP ? sp / max(bp, EPS) : equalBP ? 1.0 : bp / max(sp, EPS);
      const d = le(sp, bp) ? 100.0 * (1.0 - q) : 100.0 * (q - 1.0);
      const di = Number.isFinite(d) ? d : NaN;
      const diSma = s.diSma.step(di);

      s.plots[0][i] = { time: b.time, value: 0, color: zeroColor };
      // color = di >= 0 ? green : red
      s.plots[1][i] = { time: b.time, value: di, color: ge(di, 0) ? up : down };
      s.plots[2][i] = { time: b.time, value: cfg.showDiSma ? fin(diSma) : NaN, color: white };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DemandIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DemandIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DemandIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
