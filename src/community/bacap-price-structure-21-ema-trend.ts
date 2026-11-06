/**
 * BACAP Price Structure 21 EMA Trend (21DMA-STRUCTURE)
 *
 * EMAs 21 of the high, the close and the low, with a cloud between the high and low EMAs. The close EMA takes the
 * uptrend colour when the three EMAs rise, the downtrend colour when the three fall, and keeps its colour otherwise.
 * Bars are coloured with the bullish colour when the close is above the three EMAs, with the bearish colour when the
 * high is below the low EMA, and keep the previous bar colour otherwise.
 *
 * Reference: "BACAP PRICE STRUCTURE 21 EMA TREND" by Alex_PrimeTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Original By BalarezoCapital , Modified by PrimeTrading
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData } from '../types';

export interface BacapPriceStructure21EmaTrendInputs {
  /** Change bar color */
  changeBarCol: boolean;
  /** Line size (the plot width stays the default 3 in plotConfig) */
  lineSize: number;
  bullishColor: string;
  bearishColor: string;
  trendUpColor: string;
  trendDownColor: string;
  cloudColor: string;
}

export const defaultInputs: BacapPriceStructure21EmaTrendInputs = {
  changeBarCol: true,
  lineSize: 3,
  bullishColor: 'rgb(0, 0, 0)',
  bearishColor: 'rgb(255, 0, 255)',
  trendUpColor: 'rgb(197, 197, 197)',
  trendDownColor: 'rgb(255, 0, 255)',
  cloudColor: 'rgba(120, 123, 134, 0.36)',
};

export const inputConfig: InputConfig[] = [
  { id: 'changeBarCol', type: 'bool', title: 'Change Bar Color', defval: true },
  { id: 'lineSize', type: 'int', title: 'Line Size', defval: 3, min: 1 },
  { id: 'bullishColor', type: 'color', title: 'Bullish Candle Color', defval: 'rgb(0, 0, 0)' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Candle Color', defval: 'rgb(255, 0, 255)' },
  { id: 'trendUpColor', type: 'color', title: 'Uptrend Color', defval: 'rgb(197, 197, 197)' },
  { id: 'trendDownColor', type: 'color', title: 'Downtrend Color', defval: 'rgb(255, 0, 255)' },
  { id: 'cloudColor', type: 'color', title: 'Cloud Color', defval: 'rgba(120, 123, 134, 0.36)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA High', color: color.gray, lineWidth: 3 },
  { id: 'plot1', title: 'EMA Close', color: 'rgb(197, 197, 197)', lineWidth: 3 },
  { id: 'plot2', title: 'EMA Low', color: color.gray, lineWidth: 3 },
];

export const metadata = {
  title: '21DMA-STRUCTURE',
  shortTitle: '21DMA-STRUCTURE',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

/** nz() of an na colour: #00000000 */
const NZ_COLOR = '#00000000';

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface BacapVars {
  /** var color emaCloseColor = na */
  emaCloseColor: string | null;
  /** var color lastBarColor = na */
  lastBarColor: string | null;
}

interface BacapRun extends BarRunState<BacapVars> {
  eHigh: ReturnType<typeof taStep.ema>;
  eClose: ReturnType<typeof taStep.ema>;
  eLow: ReturnType<typeof taStep.ema>;
  emaHigh: number[];
  emaClose: number[];
  emaLow: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<BacapPriceStructure21EmaTrendInputs>): BarStudy<BacapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const eHigh = taStep.ema(21);
      const eClose = taStep.ema(21);
      const eLow = taStep.ema(21);
      const s: BacapRun = {
        eHigh, eClose, eLow, emaHigh: [], emaClose: [], emaLow: [], plot0: [], plot1: [], plot2: [], barColors: [],
        steps: [eHigh, eClose, eLow], vars: { emaCloseColor: null, lastBarColor: null }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.emaHigh, s.emaClose, s.emaLow, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const { emaHigh, emaClose, emaLow } = s;
      emaHigh[i] = s.eHigh.step(b.high);
      emaClose[i] = s.eClose.step(b.close);
      emaLow[i] = s.eLow.step(b.low);
      const isRising = i > 0 && gt(emaHigh[i], emaHigh[i - 1]) && gt(emaClose[i], emaClose[i - 1])
        && gt(emaLow[i], emaLow[i - 1]);
      const isFalling = i > 0 && gt(emaHigh[i - 1], emaHigh[i]) && gt(emaClose[i - 1], emaClose[i])
        && gt(emaLow[i - 1], emaLow[i]);
      // emaCloseColor := isRising ? trendUpColor : isFalling ? trendDownColor : nz(emaCloseColor[1])
      v.emaCloseColor = isRising ? cfg.trendUpColor : isFalling ? cfg.trendDownColor : (v.emaCloseColor ?? NZ_COLOR);

      // close above the three EMAs ? BullishColor : high < EMA21Low ? BearishColor : nz(lastBarColor[1])
      const barColor: string = gt(b.close, emaHigh[i]) && gt(b.close, emaClose[i]) && gt(b.close, emaLow[i]) ? cfg.bullishColor
        : gt(emaLow[i], b.high) ? cfg.bearishColor : (v.lastBarColor ?? NZ_COLOR);
      v.lastBarColor = barColor;
      // barcolor(changebarcol ? barColorBasedOnEMATrend : na)
      if (cfg.changeBarCol) s.barColors.push({ time: b.time, color: barColor });

      s.plot0[i] = { time: b.time, value: emaHigh[i], color: color.gray };
      s.plot1[i] = { time: b.time, value: emaClose[i], color: v.emaCloseColor };
      s.plot2[i] = { time: b.time, value: emaLow[i], color: color.gray };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        // fill(pHigh, pLow, color = cloudColor, title = 'Neutral Cloud')
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Neutral Cloud' },
            colors: new Array<string>(n).fill(cfg.cloudColor) },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BacapPriceStructure21EmaTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BacapPriceStructure21EmaTrendInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BacapPriceStructure21EmaTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
