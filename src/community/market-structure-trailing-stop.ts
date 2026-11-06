/**
 * Market Structure Trailing Stop [LuxAlgo]
 *
 * Overlay trailing stop that adapts based on market structure changes.
 * A close above the last pivot high (not yet crossed) is a bullish structure, a close below the
 * last pivot low (not yet crossed) is a bearish structure. On a reset bar the stop starts at the
 * lowest low / highest high since the pivot, then moves by the change of the running max / min
 * close times incr/100.
 * Reset modes: CHoCH (Change of Character only) or All structure breaks.
 *
 * Reference: "Market Structure Trailing Stop [LuxAlgo]" by LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketStructureTrailingStopInputs {
  length: number;
  incr: number;
  resetOn: string;
  showMS: boolean;
  bullCss: string;
  bearCss: string;
  retCss: string;
  areaTransp: number;
}

export const defaultInputs: MarketStructureTrailingStopInputs = {
  length: 14,
  incr: 100,
  resetOn: 'CHoCH',
  showMS: true,
  bullCss: '#00897B',  // Pine v5 color.teal (0xFF00897B)
  bearCss: '#FF5252',  // Pine v5 color.red (0xFFFF5252)
  retCss: '#ff5d00',
  areaTransp: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Lookback', defval: 14, min: 1 },
  { id: 'incr', type: 'float', title: 'Increment Factor %', defval: 100, min: 0 },
  { id: 'resetOn', type: 'string', title: 'Reset Stop On', defval: 'CHoCH', options: ['CHoCH', 'All'] },
  { id: 'showMS', type: 'bool', title: 'Show Structures', defval: true },
  { id: 'bullCss', type: 'color', title: 'Bullish MS', defval: '#00897B' },
  { id: 'bearCss', type: 'color', title: 'Bearish MS', defval: '#FF5252' },
  { id: 'retCss', type: 'color', title: 'Retracement', defval: '#ff5d00' },
  { id: 'areaTransp', type: 'int', title: 'Area Transparency', defval: 80, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ts', title: 'Trailing Stop', color: '#00897B', lineWidth: 1 },
  { id: 'closeLine', title: 'Close', color: '#00000000', lineWidth: 0 },
];

export const metadata = {
  title: 'Market Structure Trailing Stop',
  shortTitle: 'MSTS',
  overlay: true,
};

// Pine: indicator(..., max_lines_count = 500)
const MAX_LINES = 500;

// Pine color.new(c, transp) for a hex colour input
const withTransp = (c: string, transp: number): string => color.from_hex(c, transp) as string;

type Result = IndicatorResult & { lines: LineDrawingData[] };
type Point = { time: number; value: number; color?: string };

interface MstsVars {
  ph_y: number; ph_x: number;
  pl_y: number; pl_x: number;
  top: number; btm: number;
  ph_cross: boolean; pl_cross: boolean;
  max: number; min: number; ts: number;
  os: number;
}

interface MstsRun extends BarRunState<MstsVars> {
  ph: PivotStep;
  pl: PivotStep;
  tsPlot: Point[];
  closePlot: Point[];
  fillColors: string[];
  lines: LineDrawingData[];
}

function study(inputs: Partial<MarketStructureTrailingStopInputs>): BarStudy<MstsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = cfg.length;
  return {
    init() {
      // Pine: ph = ta.pivothigh(length, length), pl = ta.pivotlow(length, length)
      const s: MstsRun = {
        ph: new PivotStep(length, length, true),
        pl: new PivotStep(length, length, false),
        tsPlot: [], closePlot: [], fillColors: [], lines: [],
        steps: [],
        // Pine `var` state
        vars: {
          ph_y: NaN, ph_x: NaN, pl_y: NaN, pl_x: NaN, top: NaN, btm: NaN, ph_cross: false, pl_cross: false,
          max: NaN, min: NaN, ts: NaN, os: 0,
        },
        lists: [], series: [],
      };
      s.steps = [s.ph, s.pl];
      s.lists = [s.lines];
      s.series = [s.tsPlot, s.closePlot, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const close = bars[i].close;
      let ms = 0;

      // Pine `if ph` / `if pl`: na and 0 are false
      const ph = s.ph.step(i, bars[i].high);
      const pl = s.pl.step(i, bars[i].low);
      if (ph != null && !isNaN(ph) && ph !== 0) {
        v.ph_y = ph;
        v.ph_x = i - length;
        v.ph_cross = false;
      }
      if (pl != null && !isNaN(pl) && pl !== 0) {
        v.pl_y = pl;
        v.pl_x = i - length;
        v.pl_cross = false;
      }

      // Bullish structures (Pine: close > ph_y and not ph_cross; false when ph_y is na)
      if (close > v.ph_y && !v.ph_cross) {
        ms = cfg.resetOn === 'CHoCH' ? (v.os === -1 ? 1 : 0) : 1;
        v.ph_cross = true;
        if (cfg.showMS) {
          s.lines.push({
            time1: bars[v.ph_x].time, price1: v.ph_y, time2: bars[i].time, price2: v.ph_y,
            color: cfg.bullCss, width: 1, style: v.os === -1 ? 'dashed' : 'dotted',
          });
        }
        v.os = 1;
        // Pine: btm := low; for i = 0 to (n - ph_x) - 1: btm := math.min(low[i], btm)
        let btm = bars[i].low;
        for (let k = 0; k <= i - v.ph_x - 1; k++) btm = Math.min(bars[i - k].low, btm);
        v.btm = btm;
      }

      // Bearish structures
      if (close < v.pl_y && !v.pl_cross) {
        ms = cfg.resetOn === 'CHoCH' ? (v.os === 1 ? -1 : 0) : -1;
        v.pl_cross = true;
        if (cfg.showMS) {
          s.lines.push({
            time1: bars[v.pl_x].time, price1: v.pl_y, time2: bars[i].time, price2: v.pl_y,
            color: cfg.bearCss, width: 1, style: v.os === 1 ? 'dashed' : 'dotted',
          });
        }
        v.os = -1;
        // Pine: top := high; for i = 0 to (n - pl_x) - 1: top := math.max(high[i], top)
        let top = bars[i].high;
        for (let k = 0; k <= i - v.pl_x - 1; k++) top = Math.max(bars[i - k].high, top);
        v.top = top;
      }

      // Trailing max/min (Pine math.max / math.min return na when an argument is na)
      const prevMax = v.max;
      const prevMin = v.min;
      if (ms === 1) {
        v.max = close;
      } else if (ms === -1) {
        v.min = close;
      } else {
        v.max = isNaN(v.max) ? NaN : Math.max(close, v.max);
        v.min = isNaN(v.min) ? NaN : Math.min(close, v.min);
      }

      // Trailing stop
      v.ts = ms === 1 ? v.btm
        : ms === -1 ? v.top
        : v.os === 1 ? v.ts + (v.max - prevMax) * cfg.incr / 100
        : v.ts + (v.min - prevMin) * cfg.incr / 100;
      const ts = v.ts;
      const os = v.os;

      // Pine: css = ms ? na : os == 1 ? bullCss : bearCss. A value with an na colour is kept as a
      // transparent point.
      const css: string | null = ms !== 0 ? null : os === 1 ? cfg.bullCss : cfg.bearCss;
      const time = bars[i].time;
      s.tsPlot[i] = { time, value: ts, color: css ?? 'transparent' };
      // Pine: plot_price = plot(close, editable = false, display = display.none)
      s.closePlot[i] = { time, value: close };
      // Pine: css_area = (close - ts) * os < 0 ? retCss : css; fill color color.new(css_area, areaTransp).
      // When css_area is na, Pine gives color.new(na, areaTransp) as black with that transparency
      // (0x33000000 for 80), not na.
      const cssArea = (close - ts) * os < 0 ? cfg.retCss : css;
      s.fillColors[i] = withTransp(cssArea ?? '#000000', cfg.areaTransp);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          ts: s.tsPlot.slice(),
          closeLine: s.closePlot.slice(),
        },
        fills: [{ plot1: 'closeLine', plot2: 'ts', options: { color: withTransp(cfg.bullCss, cfg.areaTransp) }, colors: s.fillColors.slice() }],
        lines: s.lines.slice(-MAX_LINES),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketStructureTrailingStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketStructureTrailingStopInputs> = {}): IndicatorResult & { lines: LineDrawingData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketStructureTrailingStop = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
