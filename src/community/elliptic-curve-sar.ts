/**
 * Elliptic Curve SAR
 *
 * A Parabolic-SAR-like stop. On bar 1 the trend starts up (close > close[1]: EP = high[1], SAR = low[1]) or down
 * (EP = low[1], SAR = high[1]). On each later bar where the trend continues, a point Q on the elliptic curve
 * y^2 = x^3 + a*x + b is moved by adding the base point P (doubling when Q = P), and the acceleration is
 * initial + (max - initial) * (atan(Q.y) + pi / 2) / pi. SAR moves toward EP by that acceleration and is capped at
 * the low (uptrend) or the high (downtrend); EP is the highest high / lowest low of the trend. When the close crosses
 * the SAR, the trend reverses: SAR = EP, EP = low / high and Q is reset to P. The SAR is blue in an uptrend and red
 * in a downtrend; triangles mark the reversals and the background shows the trend.
 *
 * Reference: "Elliptic Curve SAR" by TEDCORP2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EllipticCurveSarInputs {
  /** Curve parameter a of y^2 = x^3 + a*x + b */
  a: number;
  /** Curve parameter b */
  b: number;
  /** Base point x */
  xP: number;
  /** Base point y */
  yP: number;
  initialAcc: number;
  maxAcc: number;
}

export const defaultInputs: EllipticCurveSarInputs = {
  a: 0,
  b: 1,
  xP: 2,
  yP: 3.0,
  initialAcc: 0.02,
  maxAcc: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'a', type: 'float', title: 'Curve parameter a', defval: 0, step: 0.1 },
  { id: 'b', type: 'float', title: 'Curve parameter b', defval: 1, step: 0.1 },
  { id: 'xP', type: 'float', title: 'Base point x', defval: 2, step: 0.1 },
  { id: 'yP', type: 'float', title: 'Base point y', defval: 3.0, step: 0.1 },
  { id: 'initialAcc', type: 'float', title: 'Initial acceleration', defval: 0.02, min: 0, max: 0.1, step: 0.01 },
  { id: 'maxAcc', type: 'float', title: 'Max acceleration', defval: 0.2, min: 0, max: 1.0, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EC-SAR', color: color.blue, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Extreme Point', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Elliptic Curve SAR',
  shortTitle: 'Elliptic Curve SAR',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface EcsVars {
  trend: number;
  EP: number;
  SAR: number;
  qx: number;
  qy: number;
}

interface EcsRun extends BarRunState<EcsVars> {
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number }[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<EllipticCurveSarInputs>): BarStudy<EcsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { a, xP, yP, initialAcc, maxAcc } = cfg;

  // add_P_to_Q(Q_x, Q_y): doubling when Q == P, else the chord through Q and P (plain divisions: x / 0 is
  // +-infinity, 0 / 0 na)
  const addPToQ = (v: EcsVars): void => {
    const qx = v.qx;
    const qy = v.qy;
    let slope: number;
    let x3: number;
    if (eq(qx, xP) && eq(qy, yP)) {
      slope = (3 * qx * qx + a) / (2 * qy);
      x3 = slope * slope - 2 * qx;
    } else {
      slope = (yP - qy) / (xP - qx);
      x3 = slope * slope - qx - xP;
    }
    const y3 = slope * (qx - x3) - qy;
    v.qx = x3;
    v.qy = y3;
  };

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const upBg = String(color.new(color.green, 90));
  const downBg = String(color.new(color.red, 90));

  return {
    init() {
      const s: EcsRun = {
        plot0: [], plot1: [], markers: [], bgColors: [],
        steps: [], vars: { trend: 1, EP: 0.0, SAR: 0.0, qx: xP, qy: yP }, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low, close } = bars[i];
      let reversalUp = false;
      let reversalDown = false;

      if (i === 1) {
        if (gt(close, bars[0].close)) {
          v.trend = 1;
          v.EP = bars[0].high;
          v.SAR = bars[0].low;
        } else {
          v.trend = -1;
          v.EP = bars[0].low;
          v.SAR = bars[0].high;
        }
        v.qx = xP;
        v.qy = yP;
      }

      if (i > 1) {
        if (v.trend === 1) {
          if (gt(close, v.SAR)) {
            addPToQ(v);
            const acceleration = initialAcc + ((maxAcc - initialAcc) * (Math.atan(v.qy) + Math.PI / 2)) / Math.PI;
            v.SAR = v.SAR + acceleration * (v.EP - v.SAR);
            v.SAR = gt(v.SAR, low) ? low : v.SAR;
            v.EP = Math.max(v.EP, high);
          } else {
            reversalDown = true;
            v.trend = -1;
            v.SAR = v.EP;
            v.EP = low;
            v.qx = xP;
            v.qy = yP;
          }
        } else if (lt(close, v.SAR)) {
          addPToQ(v);
          const acceleration = initialAcc + ((maxAcc - initialAcc) * (Math.atan(v.qy) + Math.PI / 2)) / Math.PI;
          v.SAR = v.SAR + acceleration * (v.EP - v.SAR);
          v.SAR = lt(v.SAR, high) ? high : v.SAR;
          v.EP = Math.min(v.EP, low);
        } else {
          reversalUp = true;
          v.trend = 1;
          v.SAR = v.EP;
          v.EP = high;
          v.qx = xP;
          v.qy = yP;
        }
      }

      const t = bars[i].time;
      s.plot0[i] = { time: t, value: fin(v.SAR), color: v.trend === 1 ? color.blue : color.red };
      s.plot1[i] = { time: t, value: fin(v.EP) };
      if (reversalUp) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      if (reversalDown) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      s.bgColors.push({ time: t, color: v.trend === 1 ? upBg : downBg });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EllipticCurveSarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EllipticCurveSarInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EllipticCurveSar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
