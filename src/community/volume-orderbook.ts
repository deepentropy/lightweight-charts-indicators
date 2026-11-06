/**
 * Volume Orderbook (Zeiierman)
 *
 * Splits the price axis into levels and adds the volume of each bar to the level that holds its source price. The
 * level height is the range of the first bar times "Width". The first bar makes one level around its source; a source
 * above the highest (below the lowest) level adds empty levels up (down) to it and then one more level, which gets the
 * volume of the bar. A source exactly on a level edge adds nothing.
 *
 * On the last bar, the "Rows" levels above and below the level of the source are drawn to the right of the bar as
 * boxes with their volume as text: red above, lime below, gray for the level of the source. The boxes are centred on
 * the same bar and get wider and more opaque with the rank of their volume among the drawn levels. "POC" extends the
 * box with the highest volume to the left, "Grid" draws a line at the top of each level and "Table" a frame around
 * the boxes.
 *
 * As in the original, the script stops with an error when the first bar has no range and a later source differs
 * from the first one (the level height is 0, the loop never ends), or when the levels would exceed 100,000 elements.
 * The original also stops on a time limit of its platform (500 ms per loop) when a rising price adds many levels at
 * once: this limit depends on the speed of the computer and is not ported; the port only stops at 100,000 levels.
 *
 * Chart context (optional third argument): the box texts use the foreground colour of the chart, read from the
 * context (`foregroundColor`). Without it the colour is #DBDBDB (dark chart).
 *
 * Reference: "Volume Orderbook (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { array, str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeOrderbookInputs {
  src: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4';
  /** Levels drawn above and below the level of the source */
  rows: number;
  /** Level height in ranges of the first bar */
  mult: number;
  /** Extend the box with the highest volume to the left */
  poc: boolean;
  /** Frame around the boxes */
  tbl: boolean;
  /** Bars between the last bar and the boxes */
  left: number;
  /** Line at the top of each level */
  tbli: boolean;
}

export const defaultInputs: VolumeOrderbookInputs = {
  src: 'close',
  rows: 10,
  mult: 0.5,
  poc: false,
  tbl: false,
  left: 5,
  tbli: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rows', type: 'int', title: 'Rows', defval: 10, min: 0, max: 50, inline: 'rows' },
  { id: 'mult', type: 'float', title: 'Width', defval: 0.5, min: 0.1, max: 10, step: 0.05, inline: 'rows' },
  { id: 'poc', type: 'bool', title: 'POC', defval: false, inline: 'rows' },
  { id: 'tbl', type: 'bool', title: 'Table', defval: false, inline: 'table' },
  { id: 'left', type: 'int', title: 'Left', defval: 5, min: 0, max: 50, step: 5, inline: 'table' },
  { id: 'tbli', type: 'bool', title: 'Grid', defval: false, inline: 'table' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Orderbook (Zeiierman)',
  shortTitle: 'Volume Orderbook (Zeiierman)',
  overlay: true,
};

/** Largest array of the original platform */
const MAX_ARRAY = 100000;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'boxes' | 'lines'> & { boxes: BoxData[]; lines: LineDrawingData[] };

interface OrderbookVars {
  /** The level height (range of the first bar times "Width") */
  step: number;
  /** The levels and their volumes (changed in place, copied by copyVars) */
  levels: number[];
  volumes: number[];
}

type OrderbookRun = BarRunState<OrderbookVars>;

function study(inputs: Partial<VolumeOrderbookInputs>): BarStudy<OrderbookRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rows = Math.trunc(cfg.rows);
  const left = Math.trunc(cfg.left);

  const source = (b: Bar): number => {
    switch (cfg.src) {
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
      case 'hlcc4': return (b.high + b.low + b.close + b.close) / 4;
      default: return b.close;
    }
  };

  /**
   * Number of levels that `while src > lvl` (up) or `while src < lvl` (down) adds from `lvl`; throws as the original
   * when the loop does not end or the array gets too large.
   */
  const checkGrowth = (i: number, src: number, from: number, step: number, up: boolean, size: number) => {
    let lvl = from;
    let count = 0;
    while (up ? gt(src, lvl) : lt(src, lvl)) {
      const next = up ? lvl + step : lvl - step;
      count++;
      if (next === lvl || size + count > MAX_ARRAY) {
        throw new Error(up
          ? `Error on bar ${i}: Loop takes too long to execute (> 500 ms)`
          : `Error on bar ${i}: Array is too large. Maximum size is ${MAX_ARRAY}.`);
      }
      lvl = next;
    }
  };

  return {
    init() {
      return { steps: [], lists: [], series: [], vars: { step: 0, levels: [], volumes: [] } };
    },
    copyVars: (v) => ({ step: v.step, levels: v.levels.slice(), volumes: v.volumes.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const levels = v.levels;
      const volumes = v.volumes;
      const bar = bars[i];
      const src = source(bar);
      const volume = bar.volume ?? NaN;
      if (i === 0) v.step = (bar.high - bar.low) * cfg.mult;
      const step = v.step;

      if (levels.length <= 0) {
        levels.push(src + step);
        levels.push(src - step);
        volumes.push(volume);
      } else {
        let found = false;
        for (let k = 0; k <= levels.length - 2; k++) {
          if (lt(src, levels[k]) && gt(src, levels[k + 1])) {
            volumes[k] = volumes[k] + volume;
            found = true;
            break;
          }
        }
        if (!found) {
          if (gt(src, levels[0])) {
            let lvl = levels[0];
            checkGrowth(i, src, lvl, step, true, levels.length);
            const addLevels: number[] = [];
            while (gt(src, lvl)) {
              addLevels.push(lvl + step);
              lvl = lvl + step;
            }
            addLevels.push(lvl + step);
            // each new level goes to the front of the array
            levels.unshift(...addLevels.reverse());
            volumes.unshift(volume, ...new Array<number>(addLevels.length - 1).fill(0));
          } else if (lt(src, levels[levels.length - 1])) {
            let lvl = levels[levels.length - 1];
            checkGrowth(i, src, lvl, step, false, levels.length);
            while (lt(src, lvl)) {
              levels.push(lvl - step);
              volumes.push(0);
              lvl = lvl - step;
            }
            levels.push(lvl - step);
            volumes.push(volume);
          }
        }
      }
    },
    // barstate.islast: the boxes and lines of the last bar, from the levels at its end
    result(s, bars, chart) {
      const n = bars.length;
      const boxes: BoxData[] = [];
      const lines: LineDrawingData[] = [];
      if (n > 0) {
        const { levels, volumes } = s.vars;
        const i = n - 1;
        const src = source(bars[i]);
        const interval = barInterval(bars);
        const T = (index: number) => barTime(bars, index, interval);
        const vols: number[] = new Array(rows * 2 + 1).fill(NaN);
        const made: Array<BoxData | null> = new Array(rows * 2 + 2).fill(null);
        for (let k = 0; k <= levels.length - 2; k++) {
          if (!(lt(src, levels[k]) && gt(src, levels[k + 1]))) continue;
          for (let x = 0; x <= Math.min(volumes.length - 1, rows * 2); x++) {
            vols[x] = k - rows + x < volumes.length - 1 ? volumes[Math.max(0, k - rows + x)] : 0;
          }
          const vol = array.copy(vols);
          array.sort(vols);
          for (let x = 0; x <= rows * 2; x++) {
            if (!(k - rows + x < levels.length - 1)) continue;
            const col = x < rows ? color.red : x > rows ? color.lime : color.gray;
            const rank = array.indexof(vols, vol[x]);
            const grade = String(color.from_gradient(rank, 0, vols.length, color.new(col, 80), color.new(col, 40)));
            made[x] = {
              time1: T(i + left + rows * 2 - rank), price1: levels[Math.max(0, k - rows + x)],
              time2: T(i + left + rows * 2 + rank), price2: levels[Math.max(1, k - rows + x + 1)],
              borderColor: grade, bgColor: grade, borderStyle: 'dotted', text: str.tostring(vol[x], 'volume'), textColor: foregroundColorOf(chart),
              ...(cfg.poc && rank === rows * 2 ? { extend: 'left' as const } : {}),
            };
            if (cfg.tbli && k - rows + x >= 0) {
              const y = levels[k - rows + x];
              lines.push({
                time1: T(i + left), price1: y, time2: T(Math.min(i + left + rows * 2 + vols.length - 1, i + 500)), price2: y,
                color: String(color.gray),
              });
            }
          }
          if (cfg.tbl) {
            // box.get_top / box.get_bottom of a box that was not made are na: the frame is not drawn
            const top = made[0] ? made[0].price1 : NaN;
            const bottom = made[rows * 2] ? made[rows * 2]!.price2 : NaN;
            made[rows * 2 + 1] = {
              time1: T(i + left), price1: top, time2: T(i + left + rows * 2 + vols.length - 1), price2: bottom,
              borderColor: String(color.gray), borderWidth: 2, bgColor: 'transparent',
            };
          }
        }
        for (const b of made) if (b && !isNaN(b.price1) && !isNaN(b.price2)) boxes.push(b);
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        boxes,
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeOrderbookInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeOrderbookInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VolumeOrderbook = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
