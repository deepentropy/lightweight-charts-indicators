/**
 * RSI Multi Length [LuxAlgo]
 *
 * RSIs of every length from the Minimum Length to the Maximum Length (N lengths), each from running averages of
 * the source change and of its absolute value with alpha = 1 / length: rsi = 50 * num / den + 50. The average of
 * the N RSIs is drawn with a gradient colour between a lower and an upper channel. The upper channel moves toward
 * the average by the share of RSIs above the overbought level, the lower channel by the share of RSIs below the
 * oversold level. Two areas show these shares in percent (from 0 up for overbought, from 100 down for oversold),
 * and a table on the last bar gives them as text.
 *
 * Reference: "RSI Multi Length [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { TableData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIMultiLengthInputs {
  /** Maximum RSI length */
  max: number;
  /** Minimum RSI length */
  min: number;
  /** Overbought level */
  overbought: number;
  /** Oversold level */
  oversold: number;
  /** Source */
  src: SourceType;
  /** Gradient colour of the average RSI at the lower channel */
  rsiAvgDnCss: string;
  /** Gradient colour of the average RSI at the upper channel */
  rsiAvgUpCss: string;
  /** Upper channel colour */
  upperCss: string;
  /** Lower channel colour */
  lowerCss: string;
  /** Overbought area colour */
  obArea: string;
  /** Oversold area colour */
  osArea: string;
}

export const defaultInputs: RSIMultiLengthInputs = {
  max: 20,
  min: 10,
  overbought: 70,
  oversold: 30,
  src: 'close',
  rsiAvgDnCss: '#ff5d00',
  rsiAvgUpCss: '#2157f3',
  upperCss: '#0cb51a',
  lowerCss: '#ff1100',
  // color.new(#0cb51a, 70) / color.new(#ff1100, 70) as input defaults: alpha 0.3 (byte 77)
  obArea: 'rgba(12, 181, 26, 0.3)',
  osArea: 'rgba(255, 17, 0, 0.3)',
};

export const inputConfig: InputConfig[] = [
  { id: 'max', type: 'int', title: 'Maximum Length', defval: 20 },
  { id: 'min', type: 'int', title: 'Minimum Length', defval: 10 },
  { id: 'overbought', type: 'float', title: 'overbought', defval: 70, step: 10 },
  { id: 'oversold', type: 'float', title: 'oversold', defval: 30, step: 10 },
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'rsiAvgDnCss', type: 'color', title: 'Average RSI Gradient', defval: '#ff5d00', group: 'Style', inline: 'inline1' },
  { id: 'rsiAvgUpCss', type: 'color', title: '', defval: '#2157f3', group: 'Style', inline: 'inline1' },
  { id: 'upperCss', type: 'color', title: 'Upper Level', defval: '#0cb51a', group: 'Style' },
  { id: 'lowerCss', type: 'color', title: 'Lower Level', defval: '#ff1100', group: 'Style' },
  { id: 'obArea', type: 'color', title: 'Overbought Area', defval: 'rgba(12, 181, 26, 0.3)', group: 'Style' },
  { id: 'osArea', type: 'color', title: 'Oversold Area', defval: 'rgba(255, 17, 0, 0.3)', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Average Multi Length RSI', color: '#2157f3', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Channel', color: '#0cb51a', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Channel', color: '#ff1100', lineWidth: 1 },
  { id: 'plot3', title: 'Overbought Area', color: 'transparent', lineWidth: 1 },
  { id: 'plot4', title: 'Oversold Area', color: 'transparent', lineWidth: 1 },
  { id: 'plot5', title: 'Upper', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Lower', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'RSI Multi Length [LuxAlgo]',
  shortTitle: 'RSI Multi Length [LuxAlgo]',
  overlay: false,
};

const GRAY = '#787B86';

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { tables: TableData[] };

interface RmlVars {
  /** var num = array.new_float(N, 0); var den = array.new_float(N, 0) (changed in place, copied by copyVars) */
  num: number[];
  den: number[];
}

interface RmlRun extends BarRunState<RmlVars> {
  src: number[];
  buyMa: number[];
  sellMa: number[];
  overbuy: number[];
  oversell: number[];
  plots: Point[][];
  fillColors: string[];
}

function study(inputs: Partial<RSIMultiLengthInputs>): BarStudy<RmlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const maxLen = Math.trunc(cfg.max);
  const minLen = Math.trunc(cfg.min);
  const N = maxLen - minLen + 1;
  const value = barSource(cfg.src);
  const nz = (v: number, r = 0) => (isNaN(v) ? r : v);
  // for i = min to max (counts down when min > max)
  const lengths: number[] = [];
  for (let l = minLen; minLen <= maxLen ? l <= maxLen : l >= maxLen; l += minLen <= maxLen ? 1 : -1) lengths.push(l);
  const overColor = String(color.new(cfg.obArea, 100));
  const underColor = String(color.new(cfg.osArea, 100));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    copyVars: (v) => ({ num: v.num.slice(), den: v.den.slice() }),
    init() {
      if (N < 0) throw new Error(`Invalid value of the 'size' argument (${N}) in the 'array.new_float' function. It must be >= 0.`);
      const s: RmlRun = {
        src: [], buyMa: [], sellMa: [], overbuy: [], oversell: [], plots: Array.from({ length: 7 }, () => []), fillColors: [],
        steps: [], vars: { num: new Array<number>(N).fill(0), den: new Array<number>(N).fill(0) }, lists: [], series: [],
      };
      s.series = [s.src, s.buyMa, s.sellMa, s.overbuy, s.oversell, ...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const { num, den } = s.vars;
      const src = s.src;
      src[i] = value(b);
      const diff = nz(i > 0 ? src[i] - src[i - 1] : NaN);
      let k = 0;
      let overbuy = 0;
      let oversell = 0;
      let avg = 0;
      for (const l of lengths) {
        if (k >= N) throw new Error(`Index ${k} is out of bounds, array size is ${N}`);
        const alpha = 1 / l;
        const numRma = alpha * diff + (1 - alpha) * num[k];
        const denRma = alpha * Math.abs(diff) + (1 - alpha) * den[k];
        // 0 / 0 is na (a flat start): the average is na on that bar
        const rsi = (50 * numRma) / denRma + 50;
        avg += rsi;
        overbuy = rsi - cfg.overbought > 1e-10 ? overbuy + 1 : overbuy;
        oversell = cfg.oversold - rsi > 1e-10 ? oversell + 1 : oversell;
        num[k] = numRma;
        den[k] = denRma;
        k += 1;
      }
      const a = avg / N;
      s.overbuy[i] = overbuy;
      s.oversell[i] = oversell;
      // buy_rsi_ma := nz(buy_rsi_ma[1] + overbuy / N * (avg_rsi - buy_rsi_ma[1]), avg_rsi)
      const pb = i > 0 ? s.buyMa[i - 1] : NaN;
      const ps = i > 0 ? s.sellMa[i - 1] : NaN;
      const buyMa = nz(pb + (overbuy / N) * (a - pb), a);
      const sellMa = nz(ps + (oversell / N) * (a - ps), a);
      s.buyMa[i] = buyMa;
      s.sellMa[i] = sellMa;

      // css = color.from_gradient(avg_rsi, sell_rsi_ma, buy_rsi_ma, rsi_avg_dn_css, rsi_avg_up_css)
      const css = color.from_gradient(a, sellMa, buyMa, cfg.rsiAvgDnCss, cfg.rsiAvgUpCss);
      const p = s.plots;
      p[0][i] = { time, value: a, color: css == null ? 'transparent' : String(css) };
      p[1][i] = { time, value: buyMa, color: cfg.upperCss };
      p[2][i] = { time, value: sellMa, color: cfg.lowerCss };
      p[3][i] = { time, value: (overbuy / N) * 100, color: overColor };
      p[4][i] = { time, value: 100 - (oversell / N) * 100, color: underColor };
      p[5][i] = { time, value: 100, color: 'transparent' };
      p[6][i] = { time, value: 0, color: 'transparent' };
      s.fillColors[i] = String(color.new(css as string, 90));
    },
    result(s, bars) {
      const n = bars.length;
      const tables: TableData[] = [];
      if (n > 0) {
        // if barstate.islast: the table of the last bar
        const last = n - 1;
        tables.push({
          position: 'top_right', columns: 2, rows: 2,
          cells: [
            { column: 0, row: 0, text: 'Overbought', textColor: GRAY, bgColor: 'transparent', textSize: 'auto' },
            { column: 1, row: 0, text: 'Oversold', textColor: GRAY, bgColor: 'transparent', textSize: 'auto' },
            { column: 0, row: 1, text: str.tostring((s.overbuy[last] / N) * 100, '#.##') + ' %', textColor: '#26a69a',
              bgColor: String(color.new('#26a69a', 80)), textSize: 'auto' },
            { column: 1, row: 1, text: str.tostring((s.oversell[last] / N) * 100, '#.##') + ' %', textColor: '#ef5350',
              bgColor: String(color.new('#ef5350', 80)), textSize: 'auto' },
          ],
        });
      }
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
          plot6: p[6].slice(),
        },
        hlines: [{ value: 50, options: { title: 'Level', color: String(color.new(GRAY, 50)), linestyle: 'dashed' } }],
        fills: [
          // fill(per_over, lower, ob_area)
          { plot1: 'plot3', plot2: 'plot6', options: { title: 'Plots Background', color: cfg.obArea } },
          // fill(upper, per_under, os_area)
          { plot1: 'plot5', plot2: 'plot4', options: { title: 'Plots Background', color: cfg.osArea } },
          // fill(up, dn, color.new(css, 90))
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' }, colors: s.fillColors.slice() },
        ],
        tables,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIMultiLengthInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIMultiLengthInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIMultiLength = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
