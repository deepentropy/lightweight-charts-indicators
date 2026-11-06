/**
 * Renko Boxes
 *
 * A Renko brick of ATR(atrLength) * atrMult is built on the close. The brick starts at the close of the first bar
 * after the ATR length (upper = close, lower = close - brick). Up bricks: a close above upper + brick moves the
 * brick up by the whole number of bricks between the upper level and the close; a close below lower - brick
 * reverses down by the whole number of bricks between the lower level and the close (and the other way round in
 * a down trend). The upper and lower levels are drawn with a fill between them, cut on the bars where they change;
 * the brick middle is drawn as a line with dots on the direction changes.
 *
 * Reference: "Renko Boxes [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RenkoBoxesInputs {
  atrLength: number;
  atrMult: number;
  bullColor: string;
  bearColor: string;
  /** Transparency of the box fill */
  fillTransp: number;
}

export const defaultInputs: RenkoBoxesInputs = {
  atrLength: 200,
  atrMult: 1.0,
  bullColor: '#089981',
  bearColor: '#f23645',
  fillTransp: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 200, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: '#089981' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: '#f23645' },
  { id: 'fillTransp', type: 'int', title: 'Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  // Pine linestyle = plot.linestyle_dotted: PlotConfig has no line style, drawn solid
  { id: 'plot0', title: 'Renko Average', color: '#089981', lineWidth: 1 },
  { id: 'plot1', title: 'Reversal Dots', color: '#089981', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Renko Upper', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Renko Lower', color: '#089981', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Renko Boxes [LuxAlgo]',
  shortTitle: 'LuxAlgo - Renko Boxes',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
/** Pine a != b: false when a or b is na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };

interface RenkoVars {
  /** var float renkoUpper = na, var float renkoLower = na, var int direction = 0 */
  renkoUpper: number;
  renkoLower: number;
  direction: number;
}

interface RenkoRun extends BarRunState<RenkoVars> {
  atr: ReturnType<typeof taStep.atr>;
  upper: number[];
  lower: number[];
  dir: number[];
  avgData: Point[];
  dotData: Point[];
  upperData: Point[];
  lowerData: Point[];
  fillColors: string[];
}

function study(inputs: Partial<RenkoBoxesInputs>): BarStudy<RenkoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const s: RenkoRun = {
        atr, upper: [], lower: [], dir: [], avgData: [], dotData: [], upperData: [], lowerData: [], fillColors: [],
        steps: [atr], vars: { renkoUpper: NaN, renkoLower: NaN, direction: 0 }, lists: [], series: [],
      };
      s.series = [s.upper, s.lower, s.dir, s.avgData, s.dotData, s.upperData, s.lowerData, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const brickSize = s.atr.step(b.high, b.low, b.close) * cfg.atrMult;
      let renkoUpper = v.renkoUpper;
      let renkoLower = v.renkoLower;
      let direction = v.direction;
      // if bar_index > atrLengthInput (bar_index: bars from the first bar of the data)
      if (i > cfg.atrLength) {
        if (isNaN(renkoUpper)) {
          renkoUpper = close;
          renkoLower = close - brickSize;
          direction = 1;
        } else {
          const upThreshold = renkoUpper + brickSize;
          const downThreshold = renkoLower - brickSize;
          const up = () => {
            const numBricks = Math.floor((close - renkoUpper) / brickSize);
            renkoLower = renkoUpper + (numBricks - 1) * brickSize;
            renkoUpper = renkoUpper + numBricks * brickSize;
          };
          const down = () => {
            const numBricks = Math.floor((renkoLower - close) / brickSize);
            renkoUpper = renkoLower - (numBricks - 1) * brickSize;
            renkoLower = renkoLower - numBricks * brickSize;
          };
          if (direction === 1) {
            if (gt(close, upThreshold)) up();
            else if (gt(downThreshold, close)) {
              down();
              direction = -1;
            }
          } else if (gt(downThreshold, close)) {
            down();
          } else if (gt(close, upThreshold)) {
            up();
            direction = 1;
          }
        }
      }
      v.renkoUpper = renkoUpper;
      v.renkoLower = renkoLower;
      v.direction = direction;
      s.upper[i] = renkoUpper;
      s.lower[i] = renkoLower;
      s.dir[i] = direction;

      // isChanged = renkoUpper != renkoUpper[1] or renkoLower != renkoLower[1]
      const changed = i > 0 && (ne(renkoUpper, s.upper[i - 1]) || ne(renkoLower, s.lower[i - 1]));
      // isReversed = ta.change(direction) != 0 (na on the first bar)
      const reversed = i > 0 && direction !== s.dir[i - 1];
      const avg = (renkoUpper + renkoLower) / 2.0;
      const plotColor = direction === 1 ? cfg.bullColor : cfg.bearColor;
      // finalColor = isChanged ? na : plotColor
      const finalColor = changed ? 'transparent' : plotColor;
      const time = b.time;
      s.avgData[i] = { time, value: avg, color: plotColor };
      s.dotData[i] = { time, value: reversed ? avg : NaN, color: plotColor };
      s.upperData[i] = { time, value: renkoUpper, color: finalColor };
      s.lowerData[i] = { time, value: renkoLower, color: finalColor };
      // fill(p1, p2, isChanged ? na : color.new(plotColor, fillTransp), "Renko Box Fill")
      s.fillColors[i] = changed ? 'transparent' : String(color.new(plotColor, cfg.fillTransp));
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.avgData.slice(),
          plot1: s.dotData.slice(),
          plot2: s.upperData.slice(),
          plot3: s.lowerData.slice(),
        },
        fills: [{
          plot1: 'plot2',
          plot2: 'plot3',
          options: { title: 'Renko Box Fill' },
          colors: s.fillColors.slice(),
        }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoBoxesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoBoxesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RenkoBoxes = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
