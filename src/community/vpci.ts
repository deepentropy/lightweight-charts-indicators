/**
 * Volume Price Confirmation Indicator (VPCI)
 *
 * Combines VWMA, SMA, and volume ratios to confirm price-volume trends.
 * VPCI = VPC * VPR * VM
 * where VPC = VWMA(long) - SMA(long), VPR = VWMA(short) / SMA(short),
 * VM = SMA(vol, short) / SMA(vol, long)
 *
 * Breaches of the Bollinger bands are the crosses of the 'Breach' plot (the original draws no shapes).
 *
 * Reference: "Volume Price Confirmation Indicator [LazyBear]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VPCIInputs {
  longLength: number;
  shortLength: number;
  signalLength: number;
  bbLength: number;
  bbMult: number;
}

export const defaultInputs: VPCIInputs = {
  longLength: 20,
  shortLength: 5,
  signalLength: 8,
  bbLength: 20,
  bbMult: 2.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 20, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal MA Length', defval: 8, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Mult', defval: 2.5, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VPCI', color: '#FF9800', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#008080', lineWidth: 1 },
  { id: 'plot2', title: 'BB Upper', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'BB Lower', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Breach', color: '#EF5350', lineWidth: 3, style: 'cross' },
];

export const metadata = {
  title: 'Volume Price Confirmation Indicator',
  shortTitle: 'VPCI',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

/** The window sums (ta.vwma / ta.sma / ta.stdev share the sums of their common inputs: the same doubles) */
interface VpciRun extends BarRunState<Record<string, never>> {
  cvLong: ReturnType<typeof taStep.sum>;
  cLong: ReturnType<typeof taStep.sum>;
  cvShort: ReturnType<typeof taStep.sum>;
  cShort: ReturnType<typeof taStep.sum>;
  volShort: ReturnType<typeof taStep.sum>;
  volLong: ReturnType<typeof taStep.sum>;
  signal: ReturnType<typeof taStep.sma>;
  basis: ReturnType<typeof taStep.sum>;
  squares: ReturnType<typeof taStep.sum>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  plot5: Point[];
}

function study(inputs: Partial<VPCIInputs>): BarStudy<VpciRun, IndicatorResult> {
  const { longLength, shortLength, signalLength, bbLength, bbMult } = { ...defaultInputs, ...inputs };
  const warmup = longLength;
  const offs_v = 0.3;
  const longLen = Math.floor(longLength);
  const shortLen = Math.floor(shortLength);
  const bbLen = Math.floor(bbLength);
  return {
    init() {
      const s: VpciRun = {
        cvLong: taStep.sum(), cLong: taStep.sum(), cvShort: taStep.sum(), cShort: taStep.sum(),
        volShort: taStep.sum(), volLong: taStep.sum(), signal: taStep.sma(), basis: taStep.sum(), squares: taStep.sum(),
        plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.cvLong, s.cLong, s.cvShort, s.cShort, s.volShort, s.volLong, s.signal, s.basis, s.squares];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.plot5];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      const vol = b.volume ?? 0;
      // ta.vwma(close, len) = sma(close * volume, len) / sma(volume, len) (na when the volume average is 0 or na)
      const volS = s.volShort.step(vol, shortLength) / shortLen;
      const volL = s.volLong.step(vol, longLength) / longLen;
      const cv = c * vol;
      const cvL = s.cvLong.step(cv, longLength) / longLen;
      const cvS = s.cvShort.step(cv, shortLength) / shortLen;
      const vwmaL = volL === 0 || isNaN(volL) ? NaN : cvL / volL;
      const smaL = s.cLong.step(c, longLength) / longLen;
      const vwmaS = volS === 0 || isNaN(volS) ? NaN : cvS / volS;
      const smaS = s.cShort.step(c, shortLength) / shortLen;

      let v: number;
      if (isNaN(vwmaL) || isNaN(smaL) || isNaN(vwmaS) || isNaN(smaS) || isNaN(volS) || isNaN(volL) || smaS === 0 || volL === 0) {
        v = NaN;
      } else {
        const vpc = vwmaL - smaL;
        const vpr = vwmaS / smaS;
        const vm = volS / volL;
        v = vpc * vpr * vm;
      }
      // Pine: s=sma(vpci, lengthMA)
      const sig = s.signal.step(v, signalLength);
      // BB bands on VPCI
      // ta.sma(vpci, bbLength) and ta.stdev(vpci, bbLength) (biased: sumSq / n - mean * mean, 0 when not positive)
      const sum = s.basis.step(v, bbLength);
      const sq = s.squares.step(isNaN(v) ? NaN : v * v, bbLength);
      const basis = sum / bbLen;
      const variance = sq / bbLen - basis * basis;
      const dev = isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
      const warm = i < warmup;

      s.plot0[i] = { time, value: warm ? NaN : v };
      s.plot1[i] = { time, value: (warm || isNaN(sig)) ? NaN : sig };
      const upper = (warm || isNaN(basis) || isNaN(dev)) ? NaN : basis + bbMult * dev;
      const lower = (warm || isNaN(basis) || isNaN(dev)) ? NaN : basis - bbMult * dev;
      s.plot2[i] = { time, value: upper };
      s.plot3[i] = { time, value: lower };
      // Pine: plot(DrawBands?basis:na, color=gray, style=line)
      s.plot4[i] = { time, value: (warm || isNaN(basis)) ? NaN : basis };

      // Pine: breach_pos = (bb_s >= upper) ? (bb_s+offs_v) : (bb_s <= lower ? (bb_s - offs_v) : 0)
      // Pine: b_color = (bb_s > upper) ? red : (bb_s < lower) ? green : na
      // Pine: plot(HighlightBreaches and Breached ? breach_pos : na, style=cross, color=b_color, linewidth=3)
      if (warm || isNaN(upper) || isNaN(lower)) {
        s.plot5[i] = { time, value: NaN };
      } else {
        const breachedUp = v >= upper;
        const breachedDn = v <= lower;
        if (!breachedUp && !breachedDn) s.plot5[i] = { time, value: NaN };
        else s.plot5[i] = { time, value: breachedUp ? v + offs_v : v - offs_v, color: breachedUp ? '#EF5350' : '#26A69A' };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice(),
          'plot4': s.plot4.slice(), 'plot5': s.plot5.slice(),
        },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
        fills: [
          { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(33, 150, 243, 0.15)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VPCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VPCIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VPCI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
