/**
 * Support & Resistance AI (K means/median) [ThinkLogicAI]
 *
 * K means (or K median) clustering of the closes of the last 'Bars back from last bar to train on' bars (the
 * current bar not included), computed on the last bar.
 * - Start centres: the close 2 % of the training length back for the first cluster, the close i / k of the training
 *   length back for cluster i.
 * - Each close goes to its nearest centre (the first one on a tie); the new centres are the mean (or median) of their
 *   closes. This repeats while the squared sum of the centre moves is above 0.01.
 * - Output: a table of the share of closes in each cluster ("Density"), and per cluster that has closes a level line
 *   at its centre (extended both ways) with, when 'Show SD bands' is on, two white lines at centre +- the deviation of
 *   its closes from the centre (also with the median) and a fill between them. Colours: green, red, blue, orange,
 *   yellow.
 * - With 3 clusters the original gives the lines x coordinates as times (xloc.bar_time) equal to bar_index - 1 and
 *   bar_index, i.e. a few milliseconds after 1970: the lines are horizontal and extended, they are drawn the same.
 *   The port keeps those coordinates.
 * - The loop has no iteration limit in the original (the Pine runtime stops a loop that runs too long); the port
 *   stops with an Error after 100,000 passes.
 *
 * Reference: "Support & Resistance AI (K means/median) [ThinkLogicAI]" by ThinkLogicAI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ThinkLogicAI
 */

import {
  array, color, math, str, line, linefill, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface SupportResistanceAiInputs {
  /** Number of clusters (3 to 5) */
  k: number;
  /** Cluster Method */
  centMeth: 'K means' | 'K median';
  /** Bars back from last bar to train on */
  trainN: number;
  /** Show SD bands */
  plotBand: boolean;
}

export const defaultInputs: SupportResistanceAiInputs = {
  k: 3,
  centMeth: 'K means',
  trainN: 252,
  plotBand: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'k', type: 'int', title: 'Number of clusters', defval: 3, min: 3, max: 5, step: 1 },
  { id: 'centMeth', type: 'string', title: 'Cluster Method', defval: 'K means', options: ['K means', 'K median'] },
  { id: 'trainN', type: 'int', title: 'Bars back from last bar to train on', defval: 252, min: 20, max: 1000, step: 1 },
  { id: 'plotBand', type: 'bool', title: 'Show SD bands', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'table'];

export const metadata = {
  title: 'K clustering',
  shortTitle: 'K clustering',
  overlay: true,
};

/** indicator(max_lines_count = 10, max_labels_count = 251) */
const MAX_LINES = 10;
const MAX_LABELS = 251;
/** Iterations after which the port stops (the Pine runtime stops a loop that takes too long) */
const MAX_PASSES = 100000;

const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLUE = '#2962FF';
const ORANGE = '#FF9800';
const YELLOW = '#FFEB3B';
const WHITE = '#FFFFFF';
const GRAY = '#787B86';
const CLUSTER_COLOURS = [GREEN, RED, BLUE, ORANGE, YELLOW];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<SupportResistanceAiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const k = cfg.k;
  const trainN = cfg.trainN;
  const kMeans = cfg.centMeth === 'K means';
  const n = bars.length;

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS });
  // var table tab = table.new(position.top_right, 2, k + 1): made on the first bar
  const tab = n > 0 ? table.new('top_right', 2, k + 1) : null;
  // var line k1 ... k6, sh_1 ... sl_6
  const kLines = CLUSTER_COLOURS.map(() => varDrawing<Line>());
  const shLines = CLUSTER_COLOURS.map(() => varDrawing<Line>());
  const slLines = CLUSTER_COLOURS.map(() => varDrawing<Line>());

  if (n > 0 && tab) {
    const last = n - 1;
    setDrawingBar(last, true);
    const x = (i: number) => (last - i >= 0 ? bars[last - i].close : NaN);

    // center_method(arry) / sd_method(arry, mu, 0): the deviation is always computed around mu (the original tests
    // cent_meth == "k means", which never matches "K means")
    const center = (arr: number[]) => {
      const a = array.from(...arr);
      return kMeans ? array.avg(a) : array.median(a);
    };
    const sdOf = (arr: number[], mu: number) => {
      let sumDif = 0;
      if (arr.length > 0) {
        for (let i = 0; i < arr.length; i++) sumDif += Math.pow(arr[i] - mu, 2);
        sumDif = Math.sqrt(sumDif / (arr.length - 0));
      }
      return sumDif;
    };

    let clust = new Array<number>(k).fill(0);
    let sdClust = new Array<number>(k).fill(0);
    let nClust = new Array<number>(k).fill(0);
    for (let i = 0; i < k; i++) clust[i] = i === 0 ? x(Math.floor(trainN * 0.02)) : x(Math.floor(trainN * (i / k)));

    let err = 100;
    let passes = 0;
    while (gt(err, 0.01)) {
      if (++passes > MAX_PASSES) throw new Error('K clustering: the clustering loop takes too long');
      const c: number[][] = [[], [], [], [], [], []];
      for (let i = 1; i <= trainN; i++) {
        let idx = NaN;
        let dist = 1000000;
        for (let j = 0; j < k; j++) {
          const dTemp = Math.sqrt(Math.pow(x(i) - clust[j], 2));
          if (lt(dTemp, dist)) {
            dist = dTemp;
            idx = j;
          }
        }
        if (!isNaN(idx)) c[idx].push(x(i));
      }
      // vector_params(k, c1, ..., c6)
      const mu = c.map(center);
      const sd = c.map((arr, j) => sdOf(arr, mu[j]));
      const sizes = c.map((arr) => arr.length);
      // err = pow(subtract_array(clust, mu), 2)
      const diff = array.from(...clust.map((v, i) => v - mu[i]));
      err = Math.pow(array.sum(diff), 2);
      clust = mu.slice(0, k);
      sdClust = sd.slice(0, k);
      nClust = sizes.slice(0, k);
    }

    // table
    const header = String(color.new(GRAY, 50));
    table.cell(tab, 0, 0, 'Cluster', undefined, undefined, WHITE, undefined, undefined, undefined, header);
    table.cell(tab, 1, 0, 'Density', undefined, undefined, WHITE, undefined, undefined, undefined, header);
    let denom = 0;
    for (let j = 0; j < k; j++) denom += nClust[j];
    for (let j = 0; j < k; j++) {
      const share = str.tostring(100 * math.round(nClust[j] / denom, 3)) + '%';
      table.cell(tab, 1, j + 1, share, undefined, undefined, WHITE, undefined, undefined, undefined,
        String(color.new(CLUSTER_COLOURS[j], 50)));
    }
    for (let j = 0; j < k; j++) {
      table.cell(tab, 0, j + 1, String(j + 1), undefined, undefined, WHITE, undefined, undefined, undefined, GRAY);
    }

    // lines: k == 3 gives the x coordinates as times (xloc.bar_time), 4 and 5 as bar indexes
    const xloc = k === 3 ? 'bar_time' : 'bar_index';
    for (let j = 0; j < k; j++) {
      if (!gt(nClust[j], 0)) continue;
      const level = clust[j];
      kLines[j].value = line.new(last - 1, level, last, level, xloc, 'both', CLUSTER_COLOURS[j], undefined, 2);
      if (cfg.plotBand) {
        const up = clust[j] + sdClust[j];
        const dn = clust[j] - sdClust[j];
        const sh = line.new(last - 1, up, last, up, xloc, 'both', WHITE, undefined, 1);
        const sl = line.new(last - 1, dn, last, dn, xloc, 'both', WHITE, undefined, 1);
        shLines[j].value = sh;
        slLines[j].value = sl;
        linefill.new(sh, sl, String(color.new(CLUSTER_COLOURS[j], 90)));
      }
    }
    setDrawingBar(null);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const SupportResistanceAi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
