/**
 * Pivot Trend [ChartPrime]
 *
 * Pivot highs of high + ATR(200) * offset and pivot lows of low - ATR(200) * offset give an upper and a lower band
 * (last pivot value). The trend is up while close stays above the lower band and turns down when close falls below
 * it; while the trend line follows the upper band, the trend turns up again when close rises above the upper band.
 * The trend line is the lower band in an up trend and the upper band in a down trend, with a gradient fill to hl2
 * and 🅑 / 🅢 marks on the trend changes.
 *
 * Reference: "Pivot Trend [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface PivotTrendInputs {
  /** Pivot left bars */
  leftBars: number;
  /** Pivot right bars */
  rightBars: number;
  /** ATR multiplier added to the high / taken from the low before the pivot search */
  offset: number;
}

export const defaultInputs: PivotTrendInputs = {
  leftBars: 10,
  rightBars: 10,
  offset: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'leftBars', type: 'int', title: 'Left Bars', defval: 10 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 10 },
  { id: 'offset', type: 'float', title: 'Offset', defval: 2, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Down Trend', color: color.blue, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Trend', color: 'transparent', lineWidth: 1 },
  { id: 'plot3', title: 'hl2', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Pivot Trend [ChartPrime]',
  shortTitle: 'Pivot Trend',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface PivotTrendRun extends BarRunState<{ phy: number; ply: number }> {
  atr: ReturnType<typeof taStep.atr>;
  ph: PivotStep;
  pl: PivotStep;
  trend: number[];
  trendLine: number[];
  hl2: number[];
  up: Point[];
  down: Point[];
  plot2: Point[];
  plot3: Point[];
  topColor: (string | null)[];
  bottomColor: (string | null)[];
  markers: MarkerData[];
}

function study(inputs: Partial<PivotTrendInputs>): BarStudy<PivotTrendRun, Result> {
  const { leftBars, rightBars, offset } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(200);
      const ph = new PivotStep(leftBars, rightBars, true);
      const pl = new PivotStep(leftBars, rightBars, false);
      const s: PivotTrendRun = {
        atr, ph, pl, trend: [], trendLine: [], hl2: [], up: [], down: [], plot2: [], plot3: [], topColor: [],
        bottomColor: [], markers: [],
        // var float phy: last pivot high (upperBand); var float ply: last pivot low (lowerBand)
        steps: [atr, ph, pl], vars: { phy: NaN, ply: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.trend, s.trendLine, s.hl2, s.up, s.down, s.plot2, s.plot3, s.topColor, s.bottomColor];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // atr = ta.atr(200); p_high = ta.pivothigh(high + atr * Offset, ...); p_low = ta.pivotlow(low - atr * Offset, ...)
      const atr = s.atr.step(b.high, b.low, b.close);
      const ph = s.ph.step(i, b.high + atr * offset);
      const pl = s.pl.step(i, b.low - atr * offset);

      // prevUpperBand = nz(upperBand[1]): phy before this bar's update
      const prevUpper = isNaN(v.phy) ? 0 : v.phy;
      // if bool(p_high): phy := p_high (bool(na) and bool(0) are false)
      if (!isNaN(ph) && ph !== 0) v.phy = ph;
      if (!isNaN(pl) && pl !== 0) v.ply = pl;

      // prevTrend = Trend[1]; if prevTrend == prevUpperBand: trend := close > upperBand ? 1 : -1
      // else trend := close < lowerBand ? -1 : 1   (a comparison with na is false)
      const prevTrend = i > 0 ? s.trendLine[i - 1] : NaN;
      const close = b.close;
      const tr = !isNaN(prevTrend) && prevTrend === prevUpper ? (close > v.phy ? 1 : -1) : (close < v.ply ? -1 : 1);
      s.trend[i] = tr;
      // Trend := trend == 1 ? lowerBand : upperBand
      const trendLine = tr === 1 ? v.ply : v.phy;
      s.trendLine[i] = trendLine;

      const col = tr === 1 ? color.blue : color.red;
      const hl2 = (b.high + b.low) / 2;
      s.hl2[i] = hl2;
      const t = b.time;
      // plot(trend < 0 ? Trend : na, 'Up Trend', color, style_linebr); plot(trend < 0 ? na : Trend, 'Down Trend', ...)
      s.up[i] = { time: t, value: tr < 0 ? trendLine : NaN, color: col };
      s.down[i] = { time: t, value: tr < 0 ? NaN : trendLine, color: col };
      // plotchar(ta.crossover(trend, 0) ? Trend : na, 'Buy', '🅑', location.absolute, color.blue, size.small)
      // plotchar(ta.crossunder(trend, 0) ? Trend : na, 'Sell', '🅢', location.absolute, color.red, size.small)
      if (i > 0 && !isNaN(trendLine)) {
        const prev = s.trend[i - 1];
        if (tr > 0 && prev <= 0) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: trendLine, shape: 'circle', color: 'transparent',
            text: '🅑', textColor: color.blue, size: 'small' });
        } else if (tr < 0 && prev >= 0) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: trendLine, shape: 'circle', color: 'transparent',
            text: '🅢', textColor: color.red, size: 'small' });
        }
      }
      // p1 = plot(Trend, color = na); p2 = plot(hl2, color = na)
      // fill(p1, p2, Trend, hl2, color.new(color, 85), color.new(color, 99))
      s.plot2[i] = { time: t, value: trendLine };
      s.plot3[i] = { time: t, value: hl2 };
      s.topColor[i] = String(color.new(col, 85));
      s.bottomColor[i] = String(color.new(col, 99));
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.up.slice(), plot1: s.down.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [{
          plot1: 'plot2', plot2: 'plot3',
          gradient: { topValue: s.trendLine.slice(), bottomValue: s.hl2.slice(), topColor: s.topColor.slice(), bottomColor: s.bottomColor.slice() },
        }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PivotTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PivotTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
