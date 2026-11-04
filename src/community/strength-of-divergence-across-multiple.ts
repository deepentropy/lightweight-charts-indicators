/**
 * Strength of Divergence Across Multiple Indicators
 *
 * Tests seven indicators (RSI 14, OBV, MACD histogram 12 / 26 / 9, Stochastic 14, CCI 20, MFI 14, Awesome
 * Oscillator) for bullish and bearish divergence with price, regular and hidden, and sums the weighted strength
 * of every divergent indicator.
 *
 * Divergence test (per indicator, per side, on every bar): when the price source forms a pivot ("Next (divergent)
 * pivot bars before / after"), the script looks back over "Lookback bars" for up to "Lookback pivots" earlier
 * price pivots (pivot length "Previous pivot bars before/after") where the indicator also pivoted on the same bar
 * or one bar before / after. The first such pivot that diverges (price lower / indicator higher for regular bullish,
 * price higher / indicator lower for hidden bullish, mirrored for bearish) gives the strength: the price change and
 * the indicator change, each in units of two standard deviations of the last 100 bars (a ratio of the two values
 * while no deviation exists), weighted by the "Δ price" / "Δ indicator" weights and by the regular / hidden weight,
 * then by the indicator weight. With "Exclude if broken trendline" the divergence is dropped when a bar between
 * the two pivots breaks the trendline by more than 1 %.
 *
 * Outputs: a line between the two price pivots of each divergence (red bearish, green bullish; dashed for hidden),
 * and on the pivot bar one label per side with the total strength and the number of divergent indicators when the
 * total is "Strong" or more (empty label below that), sized and coloured by strength, with a tooltip listing the
 * indicators. alert() when a total is above the alert value.
 *
 * Imported libraries, written in this file (only the functions that the script uses): reees/TA (version 11:
 * div_bull, div_bear and their private deltaStrength) and reees/Algebra (version 3: line_fromXy, line_getPrice).
 *
 * Reference: "Strength of Divergence Across Multiple Indicators" by reees
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © reees
 */

import {
  ta, str, math, color, line, label, resetDrawings, setDrawingBar, drawingOutputs, getSourceSeries, Series,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

export interface StrengthOfDivergenceAcrossMultipleInputs {
  bullSwitch: boolean;
  bearSwitch: boolean;
  showHidden: boolean;
  noBroken: boolean;
  ppLength: number;
  cpLengthBefore: number;
  cpLengthAfter: number;
  lbBars: number;
  lbPivs: number;
  w_reg: number;
  w_hid: number;
  w_p: number;
  w_i: number;
  bullPsource: SourceType;
  bearPsource: SourceType;
  iRsi: boolean;
  w_rsi: number;
  e_rsi: number;
  iObv: boolean;
  w_obv: number;
  e_obv: number;
  iMacd: boolean;
  w_macd: number;
  e_macd: number;
  iStoch: boolean;
  w_stoch: number;
  e_stoch: number;
  iCci: boolean;
  w_cci: number;
  e_cci: number;
  iMfi: boolean;
  w_mfi: number;
  e_mfi: number;
  iAo: boolean;
  w_ao: number;
  e_ao: number;
  /** Alert when a total strength is above a_above */
  a_on: boolean;
  a_above: number;
  showLines: boolean;
  showLabels: boolean;
  /** Total strength above which the largest label is shown */
  extrDiv: number;
  /** Total strength below which no label is shown */
  noLabB: number;
  lTransp: number;
}

export const defaultInputs: StrengthOfDivergenceAcrossMultipleInputs = {
  bullSwitch: true,
  bearSwitch: true,
  showHidden: true,
  noBroken: true,
  ppLength: 4,
  cpLengthBefore: 4,
  cpLengthAfter: 2,
  lbBars: 50,
  lbPivs: 2,
  w_reg: 1.0,
  w_hid: 1.0,
  w_p: 0.5,
  w_i: 1.5,
  bullPsource: 'low',
  bearPsource: 'high',
  iRsi: true,
  w_rsi: 1.1,
  e_rsi: 1.0,
  iObv: true,
  w_obv: 0.8,
  e_obv: 1.0,
  iMacd: true,
  w_macd: 0.9,
  e_macd: 1.0,
  iStoch: true,
  w_stoch: 0.9,
  e_stoch: 1.0,
  iCci: true,
  w_cci: 1.0,
  e_cci: 1.0,
  iMfi: true,
  w_mfi: 1.0,
  e_mfi: 1.0,
  iAo: true,
  w_ao: 1.0,
  e_ao: 1.0,
  a_on: true,
  a_above: 5.0,
  showLines: true,
  showLabels: true,
  extrDiv: 5.0,
  noLabB: 0.5,
  lTransp: 80,
};

const DP = 'Divergence Params';
const IND = 'Indicator';
const indTip = (name: string, short: string) =>
  `${name}\n\nWeight: Weight of ${short} divergence in total divergence strength calculation.\n\nExtreme divergence value: value above which ${short} divergence is considered extreme.`;
const SRC_TIP = 'Used for indicators only when appropriate. If the selected source is not technically feasible or otherwise offends the spirit of an indicator, the indicator\'s natural source will be used instead.';

const indicatorInputs = (key: string, title: string, w: number, name: string): InputConfig[] => {
  const inline = `ind_${key}`;
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  return [
    { id: `i${cap}`, type: 'bool', title, defval: true, group: IND, inline },
    { id: `w_${key}`, type: 'float', title: 'Weight', defval: w, min: 0, step: 0.1, group: IND, inline },
    {
      id: `e_${key}`, type: 'float', title: 'Extreme value', defval: 1.0, min: 0, step: 0.1, group: IND, inline,
      tooltip: indTip(name, title),
    },
  ];
};

export const inputConfig: InputConfig[] = [
  { id: 'bullSwitch', type: 'bool', title: 'Bullish', defval: true, group: DP, inline: 'dswitch' },
  { id: 'bearSwitch', type: 'bool', title: 'Bearish', defval: true, group: DP, inline: 'dswitch' },
  { id: 'showHidden', type: 'bool', title: 'Hidden', defval: true, group: DP, inline: 'dswitch' },
  {
    id: 'noBroken', type: 'bool', title: 'Exclude if broken trendline', defval: true, group: DP,
    tooltip: 'If set, divergence is not considered valid if an intermediate pivot high/low breaks the divergence trendline (on a linear scale). If using a logarithmic scale, you may want to turn this switch off as some trendlines that are broken on a linear scale may not be broken on a log scale. Only relevant if Lookback Pivots > 1.',
  },
  {
    id: 'ppLength', type: 'int', title: 'Previous pivot bars before/after', defval: 4, min: 1, group: DP,
    tooltip: 'Min # bars before and after a previous pivot high/low to consider it valid for divergence check',
  },
  {
    id: 'cpLengthBefore', type: 'int', title: 'Next (divergent) pivot bars before', defval: 4, min: 1, group: DP,
    tooltip: 'Min # leading bars before the next (divergent) pivot high/low to consider it valid for divergence check',
  },
  {
    id: 'cpLengthAfter', type: 'int', title: 'Next (divergent) pivot bars after', defval: 2, min: 1, group: DP,
    tooltip: '# trailing bars after the next (divergent) pivot high/low to consider it valid for divergence check. Decreasing this value may detect divergence sooner, but with less confidence.',
  },
  { id: 'lbBars', type: 'int', title: 'Lookback bars', defval: 50, min: 1, max: 100, group: DP, inline: 'lb' },
  {
    id: 'lbPivs', type: 'int', title: 'Lookback pivots', defval: 2, min: 1, group: DP, inline: 'lb',
    tooltip: '# of bars or # of pivot highs/lows to look back across, whichever comes first',
  },
  { id: 'w_reg', type: 'float', title: 'Regular divergence weight', defval: 1.0, min: 0, step: 0.1, group: DP, inline: 'degreg' },
  {
    id: 'w_hid', type: 'float', title: 'Hidden divergence weight', defval: 1.0, min: 0, step: 0.1, group: DP, inline: 'degreg',
    tooltip: 'Value/weight of regular divergence versus hidden divergence (applies to all indicators)',
  },
  { id: 'w_p', type: 'float', title: 'Δ price weight', defval: 0.5, min: 0, step: 0.1, group: DP, inline: 'degprice' },
  {
    id: 'w_i', type: 'float', title: 'Δ indicator weight', defval: 1.5, min: 0, step: 0.1, group: DP, inline: 'degprice',
    tooltip: 'Value/weight of change in price versus change in indicator value (applies to all indicators)',
  },
  { id: 'bullPsource', type: 'source', title: 'Bullish divergence price source', defval: 'low', group: DP, tooltip: SRC_TIP },
  { id: 'bearPsource', type: 'source', title: 'Bearish divergence price source', defval: 'high', group: DP, tooltip: SRC_TIP },
  ...indicatorInputs('rsi', 'RSI', 1.1, 'Relative Strength Index (RSI)'),
  ...indicatorInputs('obv', 'OBV', 0.8, 'On Balance Volume (OBV)'),
  ...indicatorInputs('macd', 'MACD', 0.9, 'Moving Average Convergence/Divergence (MACD)'),
  ...indicatorInputs('stoch', 'STOCH', 0.9, 'Stochastic (STOCH)'),
  ...indicatorInputs('cci', 'CCI', 1.0, 'Commodity Channel Index (CCI)'),
  ...indicatorInputs('mfi', 'MFI', 1.0, 'Money Flow Index (MFI)'),
  ...indicatorInputs('ao', 'AO', 1.0, 'Awesome Oscillator (AO)'),
  { id: 'a_on', type: 'bool', title: 'Alert', defval: true, group: 'Alerts', inline: 'alert' },
  { id: 'a_above', type: 'float', title: 'for values above', defval: 5.0, step: 0.1, group: 'Alerts', inline: 'alert' },
  { id: 'showLines', type: 'bool', title: 'Show lines', defval: true, group: 'Display Settings' },
  { id: 'showLabels', type: 'bool', title: 'Show labels', defval: true, group: 'Display Settings' },
  {
    id: 'extrDiv', type: 'float', title: 'Show largest labels for values above: ', defval: 5.0, min: 0, group: 'Display Settings',
    tooltip: 'Total divergence strength greater than this value will show the largest label (extreme divergence). A good rule of thumb is to keep this value slightly less than the number of selected indicators.',
  },
  {
    id: 'noLabB', type: 'float', title: 'Don\'t show labels for values below: ', defval: 0.5, min: 0, group: 'Display Settings',
    tooltip: 'Total divergence strength less than this value will not show any label.',
  },
  { id: 'lTransp', type: 'int', title: 'Line transparency', defval: 80, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [];

export const hasAlertFunction = true;

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Strength of Divergence Across Multiple Indicators',
  shortTitle: 'DivStr',
  overlay: true,
};

// Pine v5 colour constants
const RED = '#FF5252';
const GREEN = '#4CAF50';
const WHITE = '#FFFFFF';

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const neq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !eq(a, b);
const na = (x: number) => !Number.isFinite(x);

/** Result of div_bull / div_bear on one bar: [flag, degree, type, lx1, ly1, lx2, ly2] */
interface Div { flag: boolean; degree: number; type: number; lx1: number; ly1: number; lx2: number; ly2: number }

/** reees/TA/11 deltaStrength(): divergence strength of a change in series values */
function deltaStrength(y1: number, y2: number, std: number): number {
  if (!na(std)) return Math.abs(y2 - y1) / (std * 2);
  if (gt(Math.abs(y1), Math.abs(y2)) && neq(y1, 0)) return 1 - Math.abs(y2 / y1);
  if (gt(Math.abs(y2), Math.abs(y1)) && neq(y2, 0)) return 1 - Math.abs(y1 / y2);
  if (eq(y1, y2)) return 0.0;
  return 0.5;
}

/**
 * reees/TA/11 div_bull() (bear = false) and div_bear() (bear = true), called on every bar: the result of each bar.
 * Uses reees/Algebra/3 line_fromXy() / line_getPrice() for the trendline test.
 */
function divergence(
  bars: Bar[], bear: boolean, pS: number[], iS: number[], cpa: number, cpb: number, pl: number, lookback: number,
  lookbackPivs: number, noBroken: boolean, pW: number, iW: number, hidW: number, regW: number,
): Div[] {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const pSS = Series.fromArray(bars, pS);
  const iSS = Series.fromArray(bars, iS);
  const pivot = bear ? ta.pivothigh : ta.pivotlow;
  const p = A(pivot(pSS, pl, pl));
  const cpp = A(pivot(pSS, cpb, cpa));
  const ip = A(pivot(iSS, pl, pl));
  const ix1Raw = A((bear ? ta.highestbars : ta.lowestbars)(iSS, cpa + 2));
  const lengths = bars.map((_b, i) => (i < 100 ? i + 1 : 100));
  const pStd = A(ta.stdev(pSS, Series.fromArray(bars, lengths)));
  const iStd = A(ta.stdev(iSS, Series.fromArray(bars, lengths)));
  // x[k] on bar b: na before the first bar
  const h = (x: number[], b: number, k: number) => (b - k >= 0 && b - k < n ? x[b - k] : NaN);
  const out: Div[] = [];
  for (let b = 0; b < n; b++) {
    const r: Div = { flag: false, degree: 0.0, type: 0, lx1: 0, ly1: 0.0, lx2: 0, ly2: 0.0 };
    // ix1 := int(math.sign(ix1) * ix1); iS[na] reads the current bar
    const ix1 = na(ix1Raw[b]) ? 0 : Math.trunc(Math.sign(ix1Raw[b]) * ix1Raw[b]);
    let j = 0;
    if (!na(cpp[b])) {
      for (let i = cpa; i <= lookback + cpa; i++) {
        if (j === lookbackPivs) break;
        if (!na(h(p, b, i)) && (!na(h(ip, b, i)) || !na(h(ip, b, i + 1)) || !na(h(ip, b, i - 1)))) {
          j += 1;
          const ix2 = !na(h(ip, b, i + 1)) ? i + pl + 1 : !na(h(ip, b, i - 1)) ? i + pl - 1 : i + pl;
          const pPrev = h(p, b, i);
          const pCur = h(pS, b, cpa);
          const iPrev = h(iS, b, ix2);
          const iCur = h(iS, b, ix1);
          const strength = () => deltaStrength(pPrev, pCur, pStd[b]) * pW + deltaStrength(iCur, iPrev, iStd[b]) * iW;
          if (gt(pPrev, pCur) && lt(iPrev, iCur)) {
            r.flag = true;
            r.degree = strength() * (bear ? hidW : regW);
            r.type = bear ? 2 : 1;
          } else if (lt(pPrev, pCur) && gt(iPrev, iCur)) {
            r.flag = true;
            r.degree = strength() * (bear ? regW : hidW);
            r.type = bear ? 1 : 2;
          }
          if (r.flag) {
            r.lx1 = b - i - pl;
            r.ly1 = pPrev;
            r.lx2 = b - cpa;
            r.ly2 = pCur;
            // alg.line_fromXy()
            const slope = (r.ly1 - r.ly2) / (r.lx1 - r.lx2);
            const yInt = r.ly1 - slope * r.lx1;
            if (noBroken) {
              const step = r.lx1 <= r.lx2 ? 1 : -1;
              for (let k = r.lx1; step > 0 ? k <= r.lx2 : k >= r.lx2; k += step) {
                const v = h(pS, b, b - k);
                // alg.line_getPrice(k, slope, yInt) = slope * k + yInt
                const broken = bear ? gt(v, (slope * k + yInt) * 1.01) : lt(v, (slope * k + yInt) * 0.99);
                if (broken) {
                  r.flag = false;
                  r.degree = 0.0;
                  r.type = 0;
                  r.lx1 = 0;
                  r.ly1 = 0.0;
                  r.lx2 = 0;
                  r.ly2 = 0.0;
                  break;
                }
              }
            }
            break;
          }
        }
      }
    }
    out.push(r);
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<StrengthOfDivergenceAcrossMultipleInputs> = {},
): IndicatorResult & { alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const bullSrc = getSourceSeries(bars, cfg.bullPsource);
  const bearSrc = getSourceSeries(bars, cfg.bearPsource);
  const bullP = A(bullSrc);
  const bearP = A(bearSrc);
  const close = getSourceSeries(bars, 'close');
  const high = getSourceSeries(bars, 'high');
  const low = getSourceSeries(bars, 'low');
  const volume = getSourceSeries(bars, 'volume');
  const hl2 = getSourceSeries(bars, 'hl2');
  const cpa = cfg.cpLengthAfter;

  const noLine = !cfg.showLines;
  const noLab = !cfg.showLabels;
  const extremes: Record<string, number> = {
    RSI: cfg.e_rsi, OBV: cfg.e_obv, MACD: cfg.e_macd, STOCH: cfg.e_stoch, CCI: cfg.e_cci, MFI: cfg.e_mfi, AO: cfg.e_ao,
  };
  const strengthMap = (d: number, e: number) =>
    ge(d, e) ? 5 : gt(d, e * 0.8) ? 4 : gt(d, e * 0.6) ? 3 : gt(d, e * 0.4) ? 2 : gt(d, e * 0.2) ? 1 : 0;
  const DESC = ['Very weak', 'Weak', 'Moderate', 'Strong', 'Very strong', 'Extreme'];
  const strengthDesc = (d: number, i = '') => DESC[i !== '' ? strengthMap(d, extremes[i] ?? 0) : strengthMap(d, cfg.extrDiv)];
  const detail = (t: string, d: number) => `   ${t}:  ${strengthDesc(d, t)} (${str.tostring(math.round(d, 3))})\n`;

  // the indicators of each side (bearish on the bearish source, bullish on the bullish source)
  type Ind = { name: string; on: boolean; w: number; series: (src: Series) => number[] };
  const obv = A(ta.obv(bars));
  const stoch = A(ta.stoch(close, high, low, 14));
  const ao = A(ta.sma(hl2, 5).sub(ta.sma(hl2, 34)));
  const inds: Ind[] = [
    { name: 'RSI', on: cfg.iRsi, w: cfg.w_rsi, series: (s) => A(ta.rsi(s, 14)) },
    { name: 'OBV', on: cfg.iObv, w: cfg.w_obv, series: () => obv },
    { name: 'MACD', on: cfg.iMacd, w: cfg.w_macd, series: (s) => A(ta.macd(s, 12, 26, 9)[2]) },
    { name: 'STOCH', on: cfg.iStoch, w: cfg.w_stoch, series: () => stoch },
    { name: 'CCI', on: cfg.iCci, w: cfg.w_cci, series: (s) => A(ta.cci(s, 20)) },
    { name: 'MFI', on: cfg.iMfi, w: cfg.w_mfi, series: (s) => A(ta.mfi(s, 14, volume)) },
    { name: 'AO', on: cfg.iAo, w: cfg.w_ao, series: () => ao },
  ];
  const run = (bear: boolean, src: Series, pS: number[], ind: Ind) =>
    divergence(bars, bear, pS, ind.series(src), cpa, cfg.cpLengthBefore, cfg.ppLength, cfg.lbBars, cfg.lbPivs,
      cfg.noBroken, cfg.w_p, cfg.w_i, cfg.w_hid, cfg.w_reg);
  const results = inds.map((ind) => ({
    bear: ind.on && cfg.bearSwitch ? run(true, bearSrc, bearP, ind) : null,
    bull: ind.on && cfg.bullSwitch ? run(false, bullSrc, bullP, ind) : null,
  }));

  const lineColor = (bear: boolean) => String(color.new(bear ? RED : GREEN, cfg.lTransp));
  const alertCalls: AlertCall[] = [];
  resetDrawings({ line: 500, label: 500 });

  for (let b = 0; b < n; b++) {
    setDrawingBar(b, b === n - 1);
    const found = inds.map(() => ({ bear: false, bull: false, bearDeg: 0.0, bullDeg: 0.0 }));
    inds.forEach((ind, k) => {
      for (const side of ['bear', 'bull'] as const) {
        const res = results[k][side];
        if (!res) continue;
        const r = res[b];
        const d = r.degree * ind.w;
        if (r.flag) {
          const keep = r.type === 1 || cfg.showHidden;
          if (side === 'bear') {
            found[k].bear = keep;
            found[k].bearDeg = keep ? d : 0.0;
          } else {
            found[k].bull = keep;
            found[k].bullDeg = keep ? d : 0.0;
          }
          // drawLine()
          const hidden = r.type === 2;
          if (!noLine && (!hidden || cfg.showHidden)) {
            line.new(r.lx1, r.ly1, r.lx2, r.ly2, 'bar_index', 'none', lineColor(side === 'bear'), hidden ? 'dashed' : 'solid', 1);
          }
        }
      }
    });

    let bearCount = 0;
    let bearTotalDeg = 0.0;
    let bearIndList = '';
    let bullCount = 0;
    let bullTotalDeg = 0.0;
    let bullIndList = '';
    inds.forEach((ind, k) => {
      if (found[k].bear) {
        bearIndList += detail(ind.name, found[k].bearDeg);
        bearCount += 1;
        bearTotalDeg += found[k].bearDeg;
      }
      if (found[k].bull) {
        bullIndList += detail(ind.name, found[k].bullDeg);
        bullCount += 1;
        bullTotalDeg += found[k].bullDeg;
      }
    });

    // drawLabel()
    const drawLabel = (bear: boolean, c: number, d: number, l: string) => {
      if (c > 0 && ge(d, cfg.noLabB) && !noLab) {
        const labX = b - cpa;
        const labY = b - cpa >= 0 ? (bear ? bearP : bullP)[b - cpa] : NaN;
        const s = strengthMap(d, cfg.extrDiv);
        const dtxt = `${strengthDesc(d)} divergence (${str.tostring(math.round(d, 3))})\n`;
        const ttxt = `${dtxt} Indicator breakdown (${str.tostring(c)}):\n${l}`;
        const txt = s < 3 ? '' : `${str.tostring(math.round(d, 2))} (${str.tostring(c)})`;
        const transp = s < 4 ? 50 : 10;
        const size = s === 5 ? 'normal' : s === 4 ? 'small' : 'tiny';
        const clr = String(color.new(bear ? RED : GREEN, transp));
        label.new(labX, labY, txt, 'bar_index', 'price', clr, bear ? 'label_down' : 'label_up', WHITE, size, 'center', ttxt);
      }
    };
    drawLabel(true, bearCount, bearTotalDeg, bearIndList);
    drawLabel(false, bullCount, bullTotalDeg, bullIndList);

    if (cfg.a_on && (gt(bullTotalDeg, cfg.a_above) || gt(bearTotalDeg, cfg.a_above))) {
      alertCalls.push({
        time: bars[b].time,
        message: `Divergence strength of ${str.tostring(Math.max(bullTotalDeg, bearTotalDeg), '#.##')} has formed.`,
        freq: 'once_per_bar',
      });
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alertCalls,
  };
}

export const StrengthOfDivergenceAcrossMultiple = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction, drawingKinds,
};
