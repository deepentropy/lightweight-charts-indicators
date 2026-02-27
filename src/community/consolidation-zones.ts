/**
 * Consolidation Zones - Live
 *
 * Identifies consolidation ranges via zigzag pivot tracking.
 * When price pivots remain within a range for a minimum period,
 * a consolidation zone (top/bottom) is plotted with dashed boundary lines.
 *
 * Reference: TradingView "Consolidation Zones - Live" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData } from '../types';

export interface ConsolidationZonesInputs {
  period: number;
  consLen: number;
}

export const defaultInputs: ConsolidationZonesInputs = {
  period: 10,
  consLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Loopback Period', defval: 10, min: 2 },
  { id: 'consLen', type: 'int', title: 'Min Consolidation Length', defval: 5, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zone Top', color: '#EF5350', lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Zone Bottom', color: '#26A69A', lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Consolidation Zones - Live',
  shortTitle: 'ConsZones',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ConsolidationZonesInputs> = {}): IndicatorResult & { lines: LineDrawingData[] } {
  const { period, consLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // highestbars/lowestbars: returns how many bars ago the highest/lowest was
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hbArr = ta.highestbars(highSeries, period).toArray();
  const lbArr = ta.lowestbars(lowSeries, period).toArray();

  // highest/lowest over consLen for zone boundaries
  const hArr = ta.highest(highSeries, consLen).toArray();
  const lArr = ta.lowest(lowSeries, consLen).toArray();

  // Zigzag direction and pivot tracking
  const dirArr: number[] = new Array(n).fill(0);
  const zzArr: number[] = new Array(n).fill(NaN);
  const ppArr: number[] = new Array(n).fill(NaN);

  // Consolidation state
  const condHighArr: number[] = new Array(n).fill(NaN);
  const condLowArr: number[] = new Array(n).fill(NaN);

  let dir = 0;
  let conscnt = 0;
  let condhigh = NaN;
  let condlow = NaN;

  // Track line drawing data: Pine creates line.new from bar_index - conscnt to bar_index
  const lines: LineDrawingData[] = [];

  for (let i = 0; i < n; i++) {
    const hb = hbArr[i];
    const lb = lbArr[i];

    // hb_ = highestbars(prd) == 0 ? high : na
    // highestbars returns negative offset (0 means current bar is highest)
    const isHighPivot = (hb != null && !isNaN(hb) && hb === 0);
    const isLowPivot = (lb != null && !isNaN(lb) && lb === 0);

    const hb_ = isHighPivot ? bars[i].high : NaN;
    const lb_ = isLowPivot ? bars[i].low : NaN;

    // Update direction
    if (!isNaN(hb_) && isNaN(lb_)) {
      dir = 1;
    } else if (isNaN(hb_) && !isNaN(lb_)) {
      dir = -1;
    }
    dirArr[i] = dir;

    // Determine zz value
    if (!isNaN(hb_) && !isNaN(lb_)) {
      if (dir === 1) {
        zzArr[i] = hb_;
      } else {
        zzArr[i] = lb_;
      }
    } else if (!isNaN(hb_)) {
      zzArr[i] = hb_;
    } else if (!isNaN(lb_)) {
      zzArr[i] = lb_;
    } else {
      zzArr[i] = NaN;
    }

    // Backward scan: find the most extreme pivot in the current direction run
    let pp = NaN;
    for (let x = 0; x <= Math.min(i, 1000); x++) {
      const idx = i - x;
      if (idx < 0) break;
      // Break if direction changes
      if (dirArr[idx] !== dir) break;
      const zzVal = zzArr[idx];
      if (!isNaN(zzVal)) {
        if (isNaN(pp)) {
          pp = zzVal;
        } else {
          if (dirArr[idx] === 1 && zzVal > pp) pp = zzVal;
          if (dirArr[idx] === -1 && zzVal < pp) pp = zzVal;
        }
      }
    }
    ppArr[i] = pp;

    // Consolidation logic: triggered when pp changes
    const prevPp = i > 0 ? ppArr[i - 1] : NaN;
    const ppChanged = (isNaN(prevPp) && !isNaN(pp)) || (!isNaN(prevPp) && !isNaN(pp) && prevPp !== pp);

    if (ppChanged) {
      if (conscnt > consLen) {
        // Breakout detected (we don't need to track breakout signals for the plot)
      }
      if (conscnt > 0 && !isNaN(condhigh) && !isNaN(condlow) && pp <= condhigh && pp >= condlow) {
        conscnt = conscnt + 1;
      } else {
        conscnt = 0;
      }
    } else {
      conscnt = conscnt + 1;
    }

    // Zone boundary updates
    if (conscnt >= consLen) {
      if (conscnt === consLen) {
        condhigh = (hArr[i] != null && !isNaN(hArr[i] as number)) ? hArr[i] as number : NaN;
        condlow = (lArr[i] != null && !isNaN(lArr[i] as number)) ? lArr[i] as number : NaN;
      } else {
        if (!isNaN(condhigh)) condhigh = Math.max(condhigh, bars[i].high);
        if (!isNaN(condlow)) condlow = Math.min(condlow, bars[i].low);
      }
    }

    condHighArr[i] = conscnt >= consLen ? condhigh : NaN;
    condLowArr[i] = conscnt >= consLen ? condlow : NaN;

    // Pine: line.new(bar_index, condhigh, bar_index - conscnt, condhigh, style=dashed)
    // Emit line drawings when in consolidation zone (update each bar, replacing previous)
    if (conscnt >= consLen && !isNaN(condhigh) && !isNaN(condlow)) {
      const startIdx = Math.max(0, i - conscnt);
      // Remove previous lines for this zone (they get deleted/recreated each bar in Pine)
      // We keep only the final line per zone by checking if last line has same price
      const lastUp = lines.length >= 2 ? lines[lines.length - 2] : null;
      if (lastUp && lastUp.price1 === condhigh && lastUp.time2 === bars[i - 1]?.time) {
        // Replace the previous pair
        lines.splice(lines.length - 2, 2);
      }
      lines.push({
        time1: bars[i].time,
        price1: condhigh,
        time2: bars[startIdx].time,
        price2: condhigh,
        color: '#EF5350',
        width: 1,
        style: 'dashed',
      });
      lines.push({
        time1: bars[i].time,
        price1: condlow,
        time2: bars[startIdx].time,
        price2: condlow,
        color: '#00FF00',
        width: 1,
        style: 'dashed',
      });
    }
  }

  const warmup = period;

  const plot0 = condHighArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  const plot1 = condLowArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(33,150,243,0.15)' } },
    ],
    lines,
  };
}

export const ConsolidationZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
