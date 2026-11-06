/**
 * Res/Sup With Concavity and Increasing / Decreasing Trend Analysis
 *
 * Resistance = highest high of 20 bars, support = lowest low of 20 bars; each level snaps back to its own value of
 * k bars ago (k = 1..19, in that order) when it is within 0.1 % of it. An x-cross marks a high at or above the
 * previous resistance (above the bar) and a low at or below the previous support (below the bar).
 * Two thick lines: SMA(high, 50) + 10 % of the close, yellow when the source is above the SMA 50 bars ago (first
 * derivative up), else dark red; SMA(hlc3, 10) + 12 % of the close, orange when that difference grew over 20 bars
 * (second derivative up), else black. The fill between them is green when both are up, white when one is up, else
 * red. The background is yellow when the 10-bar linear regression of the source stayed within `rangeAccuracy` of
 * its value 10 bars before on the last six bars (a range), else black (both at 90 % transparency).
 *
 * Reference: "Res/Sup" by Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Celar
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ResSupWithConcavityInputs {
  /** Source of the first derivative and of the linear regression */
  src: SourceType;
  /** Relative range of the linear regression that counts as a range */
  rangeAccuracy: number;
}

export const defaultInputs: ResSupWithConcavityInputs = {
  src: 'hlc3',
  rangeAccuracy: 0.005,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'hlc3' },
  { id: 'rangeAccuracy', type: 'float', title: 'Range Accuracy', defval: 0.005 },
];

const RED = String(color.new(color.red, 0));
const GREEN = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: RED, lineWidth: 1 },
  { id: 'plot1', title: 'Support', color: GREEN, lineWidth: 1 },
  { id: 'plot2', title: 'First Derivative', color: color.yellow, lineWidth: 3 },
  { id: 'plot3', title: 'Second Derivative', color: color.orange, lineWidth: 3 },
];

export const metadata = {
  title: 'Res/Sup',
  shortTitle: 'Res/Sup',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Sma = WindowSma;

interface RsRun extends BarRunState<Record<string, never>> {
  dSma: Sma;
  d2Sma: Sma;
  resHi: WindowExtreme;
  supLo: WindowExtreme;
  lin: ReturnType<typeof taStep.linreg>;
  res: number[];
  sup: number[];
  d: number[];
  delsrc: number[];
  linReg: number[];
  rangeEnd: number[];
  p0: Point[];
  p1: Point[];
  p2: Point[];
  p3: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

const YELLOW_BG = String(color.new(color.yellow, 90));
const BLACK_BG = String(color.new(color.black, 90));

function study(inputs: Partial<ResSupWithConcavityInputs>): BarStudy<RsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const vari = cfg.rangeAccuracy;
  // Res := Res[k] when Res is within margin of Res[k]; Res[k] is the final Res of k bars ago
  const margin = 0.001;
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
  const hlc3 = (b: Bar) => (b.high + b.low + b.close) / 3;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: RsRun = {
        dSma: new WindowSma(50), d2Sma: new WindowSma(10), resHi: new WindowExtreme(false, 20), supLo: new WindowExtreme(true, 20),
        lin: taStep.linreg(10, 0), res: [], sup: [], d: [], delsrc: [], linReg: [], rangeEnd: [], p0: [], p1: [], p2: [],
        p3: [], fillColors: [], bgColors: [], markers: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.dSma, s.d2Sma, s.resHi, s.supLo, s.lin];
      s.lists = [s.markers];
      s.series = [s.res, s.sup, s.d, s.delsrc, s.linReg, s.rangeEnd, s.p0, s.p1, s.p2, s.p3, s.fillColors, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = value(b);
      const h3 = hlc3(b);
      const d = s.dSma.step(b.high);
      s.d[i] = d;
      const d2 = s.d2Sma.step(h3);
      let r = s.resHi.step(b.high);
      for (let k = 1; k <= 19; k++) {
        const rk = at(s.res, i - k);
        // The last test uses Sup_19 in its upper limit, as the Pine source
        const upper = k === 19 ? rk + at(s.sup, i - k) * margin : rk + rk * margin;
        if (ge(r, rk - rk * margin) && le(r, upper)) r = rk;
      }
      s.res[i] = r;
      let sp = s.supLo.step(b.low);
      for (let k = 1; k <= 19; k++) {
        const sk = at(s.sup, i - k);
        if (ge(sp, sk - sk * margin) && le(sp, sk + sk * margin)) sp = sk;
      }
      s.sup[i] = sp;

      // bo_circ_R = high >= Res[1] ? close : na; plotshape(bo_circ_R, style = shape.xcross) (location.abovebar)
      if (ge(b.high, at(s.res, i - 1)) && !isNaN(b.close)) {
        s.markers.push({ time, position: 'aboveBar', shape: 'xcross', color: RED });
      }
      // bo_circ_S = low <= Sup[1] ? close : na; plotshape(bo_circ_S, style = shape.xcross, location = location.belowbar)
      if (le(b.low, at(s.sup, i - 1)) && !isNaN(b.close)) {
        s.markers.push({ time, position: 'belowBar', shape: 'xcross', color: GREEN });
      }

      // delsrc = src - d[50]; del2src = delsrc - delsrc[20]
      const delsrc = src - at(s.d, i - 50);
      s.delsrc[i] = delsrc;
      const del2src = delsrc - at(s.delsrc, i - 20);
      s.fillColors[i] = gt(delsrc, 0) && gt(del2src, 0) ? '#43D973' : gt(delsrc, 0) || gt(del2src, 0) ? color.white : color.red;

      // Range: the linear regression within rangeAccuracy of its value 10 bars before
      const l = s.lin.step(src);
      s.linReg[i] = l;
      const l10 = at(s.linReg, i - 10);
      s.rangeEnd[i] = ge(l, l10 - l10 * vari) && le(l, l10 + l10 * vari) ? (i - 20 >= 0 ? hlc3(bars[i - 20]) : NaN) : NaN;
      let inRange = true;
      for (let j = 0; j <= 5 && inRange; j++) inRange = eq(at(s.rangeEnd, i - j), i - 20 - j >= 0 ? hlc3(bars[i - 20 - j]) : NaN);
      s.bgColors[i] = { time, color: inRange ? YELLOW_BG : BLACK_BG };

      s.p0[i] = { time, value: r, color: RED };
      s.p1[i] = { time, value: sp, color: GREEN };
      s.p2[i] = { time, value: d + b.close * 0.1, color: gt(delsrc, 0) ? color.yellow : '#D10101' };
      s.p3[i] = { time, value: d2 + b.close * 0.12, color: gt(del2src, 0.015899) ? color.orange : color.black };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.p0.slice(), plot1: s.p1.slice(), plot2: s.p2.slice(), plot3: s.p3.slice() },
        fills: [{ plot1: 'plot2', plot2: 'plot3', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ResSupWithConcavityInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ResSupWithConcavityInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ResSupWithConcavity = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
