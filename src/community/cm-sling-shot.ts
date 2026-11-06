/**
 * CM Sling Shot System
 *
 * Two-EMA crossover system that keeps traders on the trending side of the market.
 * EMA cloud with silver fill, bar coloring for pullback (yellow) and entry (aqua: close[1] below / above the current
 * fast EMA and close back across it, in the trend of the EMAs) signals, persistent per-bar trend triangles, and
 * conservative entry arrows on the same entry rule (the original's two plotarrow outputs, `arrows` of the result).
 * "Show Letters" adds the original's 'B' / 'S' characters at low - true range / high + true range on the entry bars.
 *
 * Reference: "CM Sling Shot System" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BarColorData, MarkerData } from '../types';

export interface CMSlingShotInputs {
  emaFast: number;
  emaSlow: number;
  showLetters: boolean;
}

export const defaultInputs: CMSlingShotInputs = {
  emaFast: 38,
  emaSlow: 62,
  showLetters: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFast', type: 'int', title: 'Fast EMA Length', defval: 38, min: 1 },
  { id: 'emaSlow', type: 'int', title: 'Slow EMA Length', defval: 62, min: 1 },
  { id: 'showLetters', type: 'bool', title: 'Show Letters', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA Fast', color: '#00FF00', lineWidth: 2 },
  { id: 'plot1', title: 'EMA Slow', color: '#00FF00', lineWidth: 4 },
];

export const metadata = {
  title: 'CM Sling Shot System',
  shortTitle: 'CMSlShot',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[]; markers: MarkerData[]; arrows: ArrowData[] };
type Point = { time: any; value: number; color?: string };

interface SlingRun extends BarRunState<Record<string, never>> {
  fastEma: ReturnType<typeof taStep.ema>;
  slowEma: ReturnType<typeof taStep.ema>;
  fastPlot: Point[];
  slowPlot: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
  arrows: ArrowData[];
}

// Pine: col = emaFast > emaSlow ? lime : emaFast < emaSlow ? red : yellow
const getColor = (fast: number, slow: number): string =>
  fast > slow ? '#00FF00' : fast < slow ? '#FF0000' : '#FFFF00';

function study(inputs: Partial<CMSlingShotInputs>): BarStudy<SlingRun, Result> {
  const { emaFast, emaSlow, showLetters } = { ...defaultInputs, ...inputs };
  const warmup = emaSlow;
  return {
    init() {
      const fastEma = taStep.ema(emaFast);
      const slowEma = taStep.ema(emaSlow);
      const s: SlingRun = {
        fastEma, slowEma, fastPlot: [], slowPlot: [], fillColors: [], barColors: [], markers: [], arrows: [],
        steps: [fastEma, slowEma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, s.markers, s.arrows];
      s.series = [s.fastPlot, s.slowPlot, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const { barColors, markers, arrows } = s;
      const b = bars[i];
      const time = b.time as number;
      const fv = s.fastEma.step(b.close);
      const sv = s.slowEma.step(b.close);

      if (i < warmup || fv == null) s.fastPlot[i] = { time: b.time, value: NaN };
      else s.fastPlot[i] = { time: b.time, value: fv, color: getColor(fv, sv ?? 0) };
      if (i < warmup || sv == null) s.slowPlot[i] = { time: b.time, value: NaN };
      else s.slowPlot[i] = { time: b.time, value: sv, color: getColor(fv ?? 0, sv) };

      // Pine: fill(p1, p2, color=silver, transp=50) => #C0C0C080
      s.fillColors[i] = i < warmup ? 'transparent' : '#C0C0C080';

      // The signals on the EMAs as the original computes them: na (NaN) until each EMA has its window, and a comparison
      // with na is false, so no signal before both EMAs exist; close[1] is na on the first bar.
      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const fast = fv ?? NaN;
      const slow = sv ?? NaN;
      // pullbackUpT() => emaFast > emaSlow and close < emaFast; pullbackDnT() => emaFast < emaSlow and close > emaFast
      const pullbackUp = fast > slow && close < fast;
      const pullbackDn = fast < slow && close > fast;
      // entryUpT() => emaFast > emaSlow and close[1] < emaFast and close > emaFast (the current bar's fast EMA)
      // entryDnT() => emaFast < emaSlow and close[1] > emaFast and close < emaFast
      const entryUp = fast > slow && prevClose < fast && close > fast;
      const entryDn = fast < slow && prevClose > fast && close < fast;

      // barcolor(sae and pullbackUpT() ? yellow : sae and pullbackDnT() ? yellow : na)
      // barcolor(sce and entryUpT() ? aqua : sce and entryDnT() ? aqua : na): the later barcolor wins on the same bar
      if (entryUp || entryDn) {
        barColors.push({ time, color: '#00FFFF', id: 'barcolor1' }); // aqua
      } else if (pullbackUp || pullbackDn) {
        barColors.push({ time, color: '#FFFF00', id: 'barcolor0' }); // yellow
      }

      // plotshape(st and upTrend ? upTrend : na, style=shape.triangleup, location=location.bottom, color=lime)
      if (fast >= slow) {
        markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: '', id: 'shape0' });
      }
      // plotshape(st and downTrend ? downTrend : na, style=shape.triangledown, location=location.top, color=red)
      if (fast < slow) {
        markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: '', id: 'shape1' });
      }

      // tr: true range (na on the first bar)
      const tr = i > 0 ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : NaN;

      // plotarrow(pa and codiff ? codiff : na, "Up Entry Arrow", colorup=lime): codiff = entryUpTrend
      // plotchar(sl and codiff ? low - tr : na, "Buy Entry", char='B', location.absolute, color=lime)
      if (entryUp) {
        arrows.push({ time, id: 'arrow0', value: 1, color: '#00FF00' });
        if (showLetters && !isNaN(tr)) {
          markers.push({ time, position: 'atPriceMiddle', price: b.low - tr, shape: 'circle', color: 'transparent',
            text: 'B', textColor: '#00FF00', id: 'char2' });
        }
      }
      // plotarrow(pa and codiff2*-1 ? codiff2*-1 : na, "Down Entry Arrow", colordown=red): codiff2 = entryDnTrend
      // plotchar(sl and codiff2 ? high + tr : na, "Short Entry", char='S', location.absolute, color=red)
      if (entryDn) {
        arrows.push({ time, id: 'arrow1', value: -1, color: '#FF0000' });
        if (showLetters && !isNaN(tr)) {
          markers.push({ time, position: 'atPriceMiddle', price: b.high + tr, shape: 'circle', color: 'transparent',
            text: 'S', textColor: '#FF0000', id: 'char3' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.fastPlot.slice(), 'plot1': s.slowPlot.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMSlingShotInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMSlingShotInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CMSlingShot = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
