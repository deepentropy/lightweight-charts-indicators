/**
 * Bollinger Heatmap
 *
 * For 30 Bollinger Bands of the close (lengths 14 to 364, same standard deviation multiplier), the position of the
 * close in the band: (close - lower) / (upper - lower), clamped to 0..1. Each band is a horizontal line at the
 * levels 0 to 29, coloured by its position in 10 steps of 0.1 (cold colours near the upper band, hot colours near
 * the lower band). Two transparent lines at -5 and 45 set the pane scale.
 *
 * Reference: "Bollinger Heatmap [Quantitative]" by Quantitative
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Quantitative
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

const TOTAL_BARS = 30;
const LINE_WIDTH = 4;
const BB_GROUP_NAME = 'Bollinger Bands';
const HM_GROUP_NAME = 'Heatmap Colors';
const DEFAULT_LENGTHS = [14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 105, 112, 119, 126, 133, 140, 147, 154,
  161, 168, 175, 182, 210, 238, 273, 315, 364];

export interface BollingerHeatmapInputs {
  /** Standard deviation multiplier of the bands */
  bbStd: number;
  bb01Length: number; bb02Length: number; bb03Length: number; bb04Length: number; bb05Length: number;
  bb06Length: number; bb07Length: number; bb08Length: number; bb09Length: number; bb10Length: number;
  bb11Length: number; bb12Length: number; bb13Length: number; bb14Length: number; bb15Length: number;
  bb16Length: number; bb17Length: number; bb18Length: number; bb19Length: number; bb20Length: number;
  bb21Length: number; bb22Length: number; bb23Length: number; bb24Length: number; bb25Length: number;
  bb26Length: number; bb27Length: number; bb28Length: number; bb29Length: number; bb30Length: number;
  /** Colour of a position below 0.1 (close near the lower band) */
  hot5Color: string;
  hot4Color: string;
  hot3Color: string;
  hot2Color: string;
  hot1Color: string;
  cold1Color: string;
  cold2Color: string;
  cold3Color: string;
  cold4Color: string;
  /** Colour of a position from 0.9 (close near the upper band) */
  cold5Color: string;
}

const lengthKey = (i: number) => `bb${String(i + 1).padStart(2, '0')}Length` as keyof BollingerHeatmapInputs;

export const defaultInputs: BollingerHeatmapInputs = {
  bbStd: 2.0,
  ...(Object.fromEntries(DEFAULT_LENGTHS.map((len, i) => [lengthKey(i), len])) as Record<string, number>),
  hot5Color: '#de144d',
  hot4Color: '#e78349',
  hot3Color: '#e2af4a',
  hot2Color: '#d7d96d',
  hot1Color: '#40da6e',
  cold1Color: '#1b2e7b',
  cold2Color: '#1e46b4',
  cold3Color: '#0372fa',
  cold4Color: '#25a2cf',
  cold5Color: '#34b4d1',
} as BollingerHeatmapInputs;

const COLOUR_INPUTS: [keyof BollingerHeatmapInputs, string][] = [
  ['hot5Color', '[90-100]'], ['hot4Color', '[80-90]'], ['hot3Color', '[70-80]'], ['hot2Color', '[60-70]'],
  ['hot1Color', '[50-60]'], ['cold1Color', '[40-50]'], ['cold2Color', '[30-40]'], ['cold3Color', '[20-30]'],
  ['cold4Color', '[10-20]'], ['cold5Color', '[0-10]'],
];

export const inputConfig: InputConfig[] = [
  { id: 'bbStd', type: 'float', title: 'Standard Deviation', defval: 2.0, group: BB_GROUP_NAME },
  ...DEFAULT_LENGTHS.map((len, i): InputConfig => (
    { id: lengthKey(i), type: 'int', title: `Band Length ${i + 1}`, defval: len, group: BB_GROUP_NAME })),
  ...COLOUR_INPUTS.map(([id, range]): InputConfig => (
    { id, type: 'color', title: `${range} Range Color`, defval: defaultInputs[id], group: HM_GROUP_NAME })),
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scale Low', color: '#00000000', lineWidth: LINE_WIDTH },
  { id: 'plot1', title: 'Scale High', color: '#00000000', lineWidth: LINE_WIDTH },
  ...Array.from({ length: TOTAL_BARS }, (_x, i): PlotConfig => (
    { id: `plot${i + 2}`, title: `Band ${i + 1}`, color: '#de144d', lineWidth: LINE_WIDTH })),
];

export const metadata = {
  title: 'Bollinger Heatmap [Quantitative]',
  shortTitle: 'Bollinger Heatmap [Quantitative]',
  overlay: false,
};

/** Pine a >= b: not (b - a > 1e-10); false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

export function calculate(bars: Bar[], inputs: Partial<BollingerHeatmapInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // fColorFromRatio(distanceRatio)
  const steps: [number, string][] = [
    [0.9, cfg.cold5Color], [0.8, cfg.cold4Color], [0.7, cfg.cold3Color], [0.6, cfg.cold2Color], [0.5, cfg.cold1Color],
    [0.4, cfg.hot1Color], [0.3, cfg.hot2Color], [0.2, cfg.hot3Color], [0.1, cfg.hot4Color],
  ];
  const colourOf = (r: number) => {
    for (const [lvl, c] of steps) if (ge(r, lvl)) return c;
    return cfg.hot5Color;
  };
  // math.max / math.min give na with an na argument; +-infinity stays and is clamped
  const clamp = (x: number) => (isNaN(x) ? NaN : Math.min(Math.max(x, 0.0), 1.0));

  const plots: Record<string, { time: number; value: number; color: string }[]> = {
    plot0: bars.map((b) => ({ time: b.time, value: -5, color: '#00000000' })),
    plot1: bars.map((b) => ({ time: b.time, value: 45, color: '#00000000' })),
  };
  const closeArr = bars.map((b) => b.close);
  // ta.bb(close, length, bbStd) inside `for i = 0 to TOTAL_BARS - 1`: one call site with a different length on each
  // call (basis = ta.sma, dev = bbStd * ta.stdev); the loop call sites keep the last call of each bar. Every call of a
  // bar gets the same close, so the kept history is the closes and each call gives the correctly rounded window sums
  // of the last `length` closes: the values of ta.sma / ta.stdev of the closes with that length, computed once here
  const lengths = Array.from({ length: TOTAL_BARS }, (_x, k) => cfg[lengthKey(k)] as number);
  const basisOf = lengths.map((length) => taCore.sma(closeArr, length));
  const devOf = lengths.map((length) => taCore.stdev(closeArr, length));
  const pts: { time: number; value: number; color: string }[][] = Array.from({ length: TOTAL_BARS }, () => new Array(n));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < TOTAL_BARS; k++) {
      const basis = basisOf[k][i];
      const dev = devOf[k][i];
      const u = basis + cfg.bbStd * dev;
      const l = basis - cfg.bbStd * dev;
      const bandRange = u - l;
      const distanceToLower = closeArr[i] - l;
      // plain division: x / 0 is +-infinity, 0 / 0 is na
      const distanceRatio = clamp(distanceToLower / bandRange);
      pts[k][i] = { time: bars[i].time, value: k, color: colourOf(distanceRatio) };
    }
  }
  for (let k = 0; k < TOTAL_BARS; k++) plots[`plot${k + 2}`] = pts[k];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const BollingerHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
