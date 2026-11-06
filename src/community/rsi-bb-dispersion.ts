/**
 * RSI + BB (EMA) + Dispersion
 *
 * RSI with Bollinger Bands overlay computed on the RSI values.
 * Basis = SMA(RSI, bbLen), bands = basis +/- bbMult * stdev(RSI, bbLen).
 *
 * Reference: "RSI + BB (EMA) + Dispersion"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIBBDispersionInputs {
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  forSigma: number;
  src: SourceType;
}

export const defaultInputs: RSIBBDispersionInputs = {
  rsiLen: 14,
  bbLen: 20,
  bbMult: 2.0,
  forSigma: 0.1,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'forSigma', type: 'float', title: 'Dispersion', defval: 0.1, min: 0.01, max: 1, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'BB Upper', color: '#00FFF0', lineWidth: 2 },
  { id: 'plot2', title: 'BB Lower', color: '#00FFF0', lineWidth: 2 },
  { id: 'plot3', title: 'BB Basis', color: '#000000', lineWidth: 1 },
  { id: 'dispUp', title: 'Dispersion Upper', color: '#FFFFFF', lineWidth: 1 },
  { id: 'dispDown', title: 'Dispersion Lower', color: '#FFFFFF', lineWidth: 1 },
  { id: 'hline70', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'hline30', title: 'OS Level', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'RSI + BB + Dispersion',
  shortTitle: 'RSIBB',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface RsiBbRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  rsiArr: number[];
  plots: Point[][];
}

function study(inputs: Partial<RSIBBDispersionInputs>): BarStudy<RsiBbRun, IndicatorResult> {
  const { rsiLen, bbLen, bbMult, forSigma, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = rsiLen + bbLen;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLen);
      const ema = taStep.ema(bbLen);
      const s: RsiBbRun = {
        rsi, ema, rsiArr: [], plots: Array.from({ length: 8 }, () => []),
        steps: [rsi, ema], vars: {}, lists: [], series: [],
      };
      s.series = [s.rsiArr, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const rsiArr = s.rsiArr;
      const v = s.rsi.step(value(bars[i]));
      rsiArr[i] = v;
      // Pine uses EMA for basis: basis = ema(current_rsi, for_ma)
      // and stdev for deviation: dev = for_mult * stdev(current_rsi, for_ma)
      const basis = s.ema.step(v ?? NaN);

      // Compute stdev of RSI manually (population stdev matching Pine's stdev)
      let stdev = NaN;
      if (!(i < bbLen - 1 + rsiLen)) {
        let sum = 0, count = 0;
        for (let j = i - bbLen + 1; j <= i; j++) {
          const r = rsiArr[j];
          if (r != null) { sum += r; count++; }
        }
        if (count >= 2) {
          const mean = sum / count;
          let sqSum = 0;
          for (let j = i - bbLen + 1; j <= i; j++) {
            const r = rsiArr[j];
            if (r != null) sqSum += (r - mean) * (r - mean);
          }
          stdev = Math.sqrt(sqSum / count);
        }
      }

      // Compute upper/lower BB and dispersion bands
      let upper = NaN, lower = NaN, dispUp = NaN, dispDown = NaN;
      const b = basis ?? NaN;
      const sd = stdev ?? NaN;
      if (!(isNaN(b) || isNaN(sd) || i < warmup)) {
        const dev = bbMult * sd;
        upper = b + dev;
        lower = b - dev;
        // Pine: disp_up = basis + ((upper - lower) * for_sigma)
        const bandWidth = upper - lower;
        dispUp = b + bandWidth * forSigma;
        dispDown = b - bandWidth * forSigma;
      }

      const time = bars[i].time;
      const [p0, p1, p2, p3, pUp, pDown, h70, h30] = s.plots;
      // Pine: color_rsi = current_rsi >= disp_up ? lime : current_rsi <= disp_down ? red : #ffea00
      if (v == null || i < rsiLen) {
        p0[i] = { time, value: NaN };
      } else {
        let color = '#FFEA00'; // yellow default
        if (!isNaN(dispUp) && v >= dispUp) color = '#00FF00'; // lime/green
        else if (!isNaN(dispDown) && v <= dispDown) color = '#FF0000'; // red
        p0[i] = { time, value: v, color };
      }
      p1[i] = { time, value: (isNaN(upper) || i < warmup) ? NaN : upper };
      p2[i] = { time, value: (isNaN(lower) || i < warmup) ? NaN : lower };
      p3[i] = { time, value: (basis == null || isNaN(basis) || i < warmup) ? NaN : basis };
      pUp[i] = { time, value: (isNaN(dispUp) || i < warmup) ? NaN : dispUp };
      pDown[i] = { time, value: (isNaN(dispDown) || i < warmup) ? NaN : dispDown };
      // Invisible anchor plots at 70 and 30 for hline band fill
      h70[i] = { time, value: i < warmup ? NaN : 70 };
      h30[i] = { time, value: i < warmup ? NaN : 30 };
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, dispUpPlot, dispDownPlot, hline70Plot, hline30Plot] = s.plots.map((p) => p.slice());
      const fills: FillData[] = [
        // Pine: fill(s1, s2, color=white, transp=80) - dispersion band fill (untitled: 'Plots Background')
        { plot1: 'dispUp', plot2: 'dispDown', options: { color: 'rgba(255,255,255,0.20)', title: 'Plots Background' } },
        // Pine: fill(h1, h2, transp=95) - hline band fill between 70/30
        { plot1: 'hline70', plot2: 'hline30', options: { color: 'rgba(128,128,128,0.05)', title: 'OB/OS Band' } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'dispUp': dispUpPlot, 'dispDown': dispDownPlot, 'hline70': hline70Plot, 'hline30': hline30Plot },
        hlines: [
          { value: 70, options: { color: '#D4D4D4', linestyle: 'dotted' as const, title: 'Overbought' } },
          { value: 30, options: { color: '#D4D4D4', linestyle: 'dotted' as const, title: 'Oversold' } },
        ],
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIBBDispersionInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIBBDispersionInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIBBDispersion = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
