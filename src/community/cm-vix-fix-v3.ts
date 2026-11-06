/**
 * CM Williams Vix Fix V3 Ultimate
 *
 * Enhanced Williams Vix Fix with Bollinger Band and percentile alerting.
 * WVF = (highest(close, length) - low) / highest(close, length) * 100.
 * Alerts when WVF exceeds BB upper or percentile range high.
 *
 * Reference: "CM_Williams_Vix_Fix_V3_Ultimate" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMVixFixV3Inputs {
  length: number;
  bbLen: number;
  bbMult: number;
  lookbackPct: number;
  pctHighest: number;
  ltLB: number;
  mtLB: number;
  str: number;
  sbc: boolean;
  sbcc: boolean;
  sbcFilt: boolean;
  sbcAggr: boolean;
  sgb: boolean;
}

export const defaultInputs: CMVixFixV3Inputs = {
  length: 22,
  bbLen: 20,
  bbMult: 2.0,
  lookbackPct: 50,
  pctHighest: 0.85,
  ltLB: 40,
  mtLB: 14,
  str: 3,
  sbc: true,
  sbcc: false,
  sbcFilt: true,
  sbcAggr: false,
  sgb: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'WVF Length', defval: 22, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lookbackPct', type: 'int', title: 'Pct Lookback', defval: 50, min: 1 },
  { id: 'pctHighest', type: 'float', title: 'Pct Highest', defval: 0.85, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'ltLB', type: 'int', title: 'Long-Term LB', defval: 40, min: 1 },
  { id: 'mtLB', type: 'int', title: 'Medium-Term LB', defval: 14, min: 1 },
  { id: 'str', type: 'int', title: 'Entry Strength', defval: 3, min: 1 },
  { id: 'sbc', type: 'bool', title: 'Highlight WVF Was True Now False', defval: true },
  { id: 'sbcc', type: 'bool', title: 'Highlight WVF Is True', defval: false },
  { id: 'sbcFilt', type: 'bool', title: 'Highlight Filtered Entry', defval: true },
  { id: 'sbcAggr', type: 'bool', title: 'Highlight Aggressive Filtered Entry', defval: false },
  { id: 'sgb', type: 'bool', title: 'Turn All Bars Gray', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Williams Vix Fix', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Alert If WVF = True', color: '#00FF00', lineWidth: 2 },
  { id: 'plot2', title: 'Alert If WVF Was True Now False', color: '#00FFFF', lineWidth: 2 },
  { id: 'plot3', title: 'Alert Filtered Entry', color: '#FF00FF', lineWidth: 2 },
  { id: 'plot4', title: 'Alert Aggressive Filtered Entry', color: '#FFA500', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Williams Vix Fix V3',
  shortTitle: 'VixFixV3',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface VixRun extends BarRunState<Record<string, never>> {
  highestClose: WindowExtreme;
  mid: WindowSma;
  dev: WindowStdev;
  wvfHigh: WindowExtreme;
  wvf: number[];
  upperBand: number[];
  rangeHigh: number[];
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<CMVixFixV3Inputs>): BarStudy<VixRun, Result> {
  const { length, bbLen, bbMult, lookbackPct, pctHighest, ltLB, mtLB, str, sbc, sbcc, sbcFilt, sbcAggr, sgb } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(length, bbLen, lookbackPct);
  return {
    init() {
      const s: VixRun = {
        highestClose: new WindowExtreme(false, length),
        // BB on WVF
        mid: new WindowSma(bbLen),
        dev: new WindowStdev(bbLen),
        // Range high for percentile threshold: rangeHigh = highest(wvf, lb) * ph
        wvfHigh: new WindowExtreme(false, lookbackPct),
        wvf: [], upperBand: [], rangeHigh: [],
        plots: Array.from({ length: 5 }, () => []),
        barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.highestClose, s.mid, s.dev, s.wvfHigh];
      s.lists = [s.barColors];
      s.series = [s.wvf, s.upperBand, s.rangeHigh, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // WVF = ((highest(close, pd) - low) / highest(close, pd)) * 100
      const hc = s.highestClose.step(b.close);
      const wvf = hc === 0 || isNaN(hc) ? 0 : ((hc - b.low) / hc) * 100;
      s.wvf[i] = wvf;
      const midLine = s.mid.step(wvf);
      const sDev = s.dev.step(wvf);
      const ub = midLine + bbMult * sDev;
      const rh = s.wvfHigh.step(wvf) * pctHighest;
      s.upperBand[i] = ub;
      s.rangeHigh[i] = rh;

      const p = s.plots;
      if (i < warmup) {
        for (let k = 0; k < 5; k++) p[k]![i] = { time, value: NaN };
        return;
      }

      // Alert signals (Pine: alert1-4)
      // alert1: wvf >= upperBand or wvf >= rangeHigh
      const isActive = wvf >= ub || wvf >= rh;
      const alert1 = isActive ? 1 : 0;
      let alert2 = 0;
      let alert3 = 0;
      let alert4 = 0;

      // alert2: (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh)
      if (i > 0) {
        const prevWvf = s.wvf[i - 1]!;
        const prevUb = s.upperBand[i - 1]!;
        const prevRh = s.rangeHigh[i - 1]!;
        const wasActive = prevWvf >= prevUb || prevWvf >= prevRh;
        alert2 = (wasActive && !isActive) ? 1 : 0;
      }

      // Filtered entry criteria
      if (i >= Math.max(str, ltLB, mtLB) + 1) {
        // upRange = low > low[1] and close > high[1]
        const upRange = b.low > bars[i - 1].low && b.close > bars[i - 1].high;
        // filtered = ((wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh))
        const prevWvf2 = s.wvf[i - 1]!;
        const prevUb2 = s.upperBand[i - 1]!;
        const prevRh2 = s.rangeHigh[i - 1]!;
        const filtered = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && (wvf < ub && wvf < rh);
        const closeStr = b.close > bars[i - str].close;
        const closeLt = b.close < bars[i - ltLB].close || b.close < bars[i - mtLB].close;
        // alert3 = upRange and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered
        alert3 = (upRange && closeStr && closeLt && filtered) ? 1 : 0;

        // upRange_Aggr = close > close[1] and close > open[1]
        const upRangeAggr = b.close > bars[i - 1].close && b.close > bars[i - 1].open;
        // filtered_Aggr = (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and not (wvf < upperBand and wvf < rangeHigh)
        const filteredAggr = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && !(wvf < ub && wvf < rh);
        // alert4 = upRange_Aggr and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered_Aggr
        alert4 = (upRangeAggr && closeStr && closeLt && filteredAggr) ? 1 : 0;
      }

      // Pine: col = wvf >= upperBand or wvf >= rangeHigh ? lime : gray
      // Pine: plot(wvf * -1, style=columns, linewidth=4, color=col)
      p[0]![i] = { time, value: wvf * -1, color: isActive ? '#00FF00' : '#808080' };
      // Pine: plot(sa1 and alert1 ? alert1 : 0, style=line, linewidth=2, color=lime)
      // Always show (sa1 defaults not toggled, but we always plot for display fidelity)
      p[1]![i] = { time, value: alert1 };
      // Pine: plot(sa2 and alert2 ? alert2 : 0, style=line, linewidth=2, color=aqua)
      p[2]![i] = { time, value: alert2 };
      // Pine: plot(sa3 and alert3 ? alert3 : 0, style=line, linewidth=2, color=fuchsia)
      p[3]![i] = { time, value: alert3 };
      // Pine: plot(sa4 and alert4 ? alert4 : 0, style=line, linewidth=2, color=orange)
      p[4]![i] = { time, value: alert4 };

      // barcolor: Pine applies multiple barcolor() calls; later calls override earlier.
      // Priority (lowest to highest): alert4 orange, alert3 fuchsia, alert2 aqua, alert1 lime
      // Each is gated by its boolean toggle (sbcAggr, sbcFilt, sbc, sbcc).
      // sgb = gray overrides everything when enabled.
      let c: string | null = null;
      if (sbcAggr && alert4 === 1) c = '#FFA500';  // orange
      if (sbcFilt && alert3 === 1) c = '#FF00FF';  // fuchsia
      if (sbc && alert2 === 1) c = '#00FFFF';      // aqua
      if (sbcc && alert1 === 1) c = '#00FF00';     // lime
      if (sgb) c = '#808080';                      // gray overrides all
      if (c) s.barColors.push({ time, color: c });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0]!.slice(), 'plot1': p[1]!.slice(), 'plot2': p[2]!.slice(), 'plot3': p[3]!.slice(), 'plot4': p[4]!.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMVixFixV3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMVixFixV3Inputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CMVixFixV3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
