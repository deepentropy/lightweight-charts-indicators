/**
 * Savitzky Flow Bands [ChartPrime]
 *
 * Filter: a weighted sum of the last 16 closes with the fixed coefficients of the script (-4 .. 3, then eight times
 * -4, normalised by their sum -36), averaged over length - 1 bars. Bands at the filter +/- 2 * SMA(high - low, 100)
 * only move up (lower band) or down (upper band) while close stays on the band side, as a trailing stop. The direction
 * turns up when close is above the upper band and down when close is below the lower band. The trend band follows
 * the lower band in an up trend and the upper band in a down trend; a thicker copy fades as the trend gets older.
 * Diamonds (drawn one bar later) mark the direction changes; candles take the direction colour.
 *
 * Reference: "Savitzky Flow Bands [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SavitzkyFlowBandsInputs {
  /** Length: the filter is averaged over length - 1 bars */
  length: number;
  /** Up colour */
  colorUp: string;
  /** Down colour */
  colorDn: string;
  /** Colour the candles with the direction colour */
  candles: boolean;
}

export const defaultInputs: SavitzkyFlowBandsInputs = {
  length: 15,
  colorUp: '#31ca45',
  colorDn: '#FF7112',
  candles: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 15 },
  { id: 'colorUp', type: 'color', title: 'Up', defval: '#31ca45' },
  { id: 'colorDn', type: 'color', title: 'Down', defval: '#FF7112' },
  { id: 'candles', type: 'bool', title: 'CandleStick Color', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#31ca45', lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Trend Band', color: '#31ca45', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Trend Extinguishing', color: '#31ca45', lineWidth: 4, style: 'linebr' },
];

export const metadata = {
  title: 'Savitzky Flow Bands [ChartPrime]',
  shortTitle: 'Savitzky Flow Bands',
  overlay: true,
};

// Pine compares floats with a tolerance of 1e-10 (a comparison with na is false)
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * Coefficients of the script: for i = -4 to 4, coefficients[i + 4] = i; at i = 4 the loop `for j = 5 to -4` (Pine
 * counts down) sets coefficients[8 .. 15] = j for each j, so the last value -4 stays.
 */
function coefficients(): number[] {
  const c: number[] = new Array(16).fill(NaN);
  for (let i = -4; i <= 4; i++) {
    c[i + 4] = i;
    if (i === 4) {
      for (let j = 5; j >= -4; j--) {
        for (let g = 8; g <= 15; g++) c[g] = j;
      }
    }
  }
  return c;
}

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  barColors: BarColorData[];
  plotCandles: Record<string, PlotCandleData[]>;
};
type Point = { time: number; value: number; color: string };

interface SfbVars {
  /** var direction = int(na) */
  dir: number;
  /** var count = 0 */
  cnt: number;
}

interface SfbRun extends BarRunState<SfbVars> {
  poly: WindowSum;
  dist: WindowSma;
  close: number[];
  basis: number[];
  lBand: number[];
  hBand: number[];
  direction: number[];
  plots: Point[][];
  barColors: BarColorData[];
  candleData: PlotCandleData[];
  /** Bars where the direction changes and their band (the diamonds, drawn one bar later) */
  changeBars: number[];
  changeBands: number[];
}

function study(inputs: Partial<SavitzkyFlowBandsInputs>): BarStudy<SfbRun, Result> {
  const { length, colorUp, colorDn, candles } = { ...defaultInputs, ...inputs };
  // savitzky_golay_filter_w_15_vectors(close)
  const coef = coefficients();
  const normFactor = coef.reduce((s, v) => s + v, 0); // coefficients.sum() = -36
  const last = length - 1;
  const upFaded = String(color.new(colorUp, 70));
  return {
    init() {
      // for i = 1 to length - 1: polynomial := math.sum(sum / norm_factor, i) / i
      // The value kept is the one of the last loop index, length - 1. With length <= 1 the loop (counting down) reaches
      // i = 0, and Pine stops with a runtime error: math.sum length must be > 0.
      if (length < 2) {
        throw new Error("Invalid value of the 'length' argument (0) in the 'sum' function. It must be > 0.");
      }
      const s: SfbRun = {
        poly: new WindowSum(last), dist: new WindowSma(100), close: [], basis: [], lBand: [], hBand: [], direction: [],
        plots: [[], [], []], barColors: [], candleData: [], changeBars: [], changeBands: [],
        steps: [], vars: { dir: NaN, cnt: 0 }, lists: [], series: [],
      };
      s.steps = [s.poly, s.dist];
      s.lists = [s.changeBars, s.changeBands];
      s.series = [s.close, s.basis, s.lBand, s.hBand, s.direction, ...s.plots];
      if (candles) s.series.push(s.barColors, s.candleData);
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const close = s.close;
      close[i] = b.close;
      // sum = sum of coefficients[i] * source[i], i = 0 .. 15 (na while source[i] is na)
      let sum = 0;
      for (let k = 0; k < coef.length; k++) sum += coef[k] * (i - k >= 0 ? close[i - k] : NaN);
      const basis = s.poly.step(sum / normFactor) / last;
      s.basis[i] = basis;
      // distance = ta.sma(high - low, 100) * 2
      const distance = s.dist.step(b.high - b.low) * 2;

      let l = basis - distance;
      let h = basis + distance;
      // prevLowerBand = nz(l_band[1]); prevUpperBand = nz(h_band[1])
      const prevL = i > 0 && !isNaN(s.lBand[i - 1]) ? s.lBand[i - 1] : 0;
      const prevU = i > 0 && !isNaN(s.hBand[i - 1]) ? s.hBand[i - 1] : 0;
      const prevClose = i > 0 ? close[i - 1] : NaN;
      // l_band := l_band > prevLowerBand or close[1] < prevLowerBand ? l_band : prevLowerBand
      l = gt(l, prevL) || lt(prevClose, prevL) ? l : prevL;
      // h_band := h_band < prevUpperBand or close[1] > prevUpperBand ? h_band : prevUpperBand
      h = lt(h, prevU) || gt(prevClose, prevU) ? h : prevU;
      s.lBand[i] = l;
      s.hBand[i] = h;
      if (gt(b.close, h)) v.dir = 1;
      if (lt(b.close, l)) v.dir = 0;
      const dir = v.dir;
      s.direction[i] = dir;
      // change = direction != direction[1] (a comparison with na is false)
      const prevDir = i > 0 ? s.direction[i - 1] : NaN;
      const change = !isNaN(dir) && !isNaN(prevDir) && dir !== prevDir;
      // if direction == direction (not na): count += 1; if change: count := 0
      if (!isNaN(dir)) v.cnt += 1;
      if (change) v.cnt = 0;
      const count = v.cnt;

      const up = dir > 0;
      // t_color = basis > basis[2] ? color_up : color_dn
      const tColor = i >= 2 && gt(basis, s.basis[i - 2]) ? colorUp : colorDn;
      // plot(basis, color = t_color, title = "Filter", style = plot.style_circles)
      s.plots[0][i] = { time: t, value: basis, color: tColor };

      // plotshape(change ? t_band : na, shape.diamond, color_up, size.tiny, location.absolute, offset = 1), and the same
      // with color.new(color_up, 70), size.small: drawn one bar later (placed in the result)
      const tBand = up ? l : h;
      if (change && !isNaN(tBand)) {
        s.changeBars.push(i);
        s.changeBands.push(tBand);
      }

      // plot(change ? na : (direction > 0 ? l_band : h_band), "Trend Band", plot.style_linebr, color_up)
      const band = change ? NaN : tBand;
      s.plots[1][i] = { time: t, value: band, color: colorUp };
      // "Trend Extinguishing": color.from_gradient(count, 10, 100, color_up, color(na)), linewidth 4.
      // color(na) has no colour: '#00000000' (alpha 0), which from_gradient treats as na.
      s.plots[2][i] = { time: t, value: band, color: String(color.from_gradient(count, 10, 100, colorUp, '#00000000')) };

      // candl_col = direction > 0 ? color_up : color_dn; barcolor and plotcandle(force_overlay) when candles
      const candleColor = up ? colorUp : colorDn;
      if (candles) {
        s.barColors[i] = { time: t, color: candleColor };
        s.candleData[i] = {
          time: t, open: b.open, high: b.high, low: b.low, close: b.close,
          color: candleColor, wickColor: candleColor, borderColor: candleColor, forceOverlay: true,
        };
      }
    },
    result(s, bars) {
      const n = bars.length;
      const cb = s.changeBars;
      // the time of the bar after the last one: the bar interval of the whole set
      const interval = cb.length > 0 && cb[cb.length - 1] + 1 >= n ? barInterval(bars) : undefined;
      const markers: MarkerData[] = [];
      for (let k = 0; k < cb.length; k++) {
        const mt = barTime(bars, cb[k] + 1, interval);
        const price = s.changeBands[k];
        markers.push({ time: mt, position: 'atPriceMiddle', price, shape: 'diamond', color: colorUp, size: 'tiny', id: 'shape0' });
        markers.push({ time: mt, position: 'atPriceMiddle', price, shape: 'diamond', color: upFaded, size: 'small', id: 'shape1' });
      }
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice() },
        markers,
        barColors: s.barColors.slice(),
        plotCandles: (candles ? { candle0: s.candleData.slice() } : {}) as Record<string, PlotCandleData[]>,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SavitzkyFlowBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SavitzkyFlowBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SavitzkyFlowBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
