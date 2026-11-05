/**
 * Machine Learning RSI [BullVision]
 *
 * kNN applied to RSI for adaptive overbought/oversold thresholds.
 * Finds k-nearest historical bars with similar RSI values, then analyzes
 * what price did after those readings to compute adaptive OB/OS levels.
 *
 * Reference: "Machine Learning RSI [BullVision]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { TableData, TableCell, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MlRsiInputs {
  rsiLen: number;
  k: number;
  lookback: number;
  src: SourceType;
}

export const defaultInputs: MlRsiInputs = {
  rsiLen: 14,
  k: 10,
  lookback: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 10, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 200, min: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Adaptive OB', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Adaptive OS', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: '50 Level', color: 'rgba(255,255,255,0.3)', lineWidth: 1 },
];

export const metadata = {
  title: 'ML RSI',
  shortTitle: 'MLRSI',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { tables: TableData[]; barColors: BarColorData[] };
type Point = { time: number; value: number };

interface MlRsiVars {
  lastRsi: number;
  lastOb: number;
  lastOs: number;
  lastPrediction: string;
}

interface MlRsiRun extends BarRunState<MlRsiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsiArr: number[];
  closeArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<MlRsiInputs>): BarStudy<MlRsiRun, Result> {
  const { rsiLen, k, lookback, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = rsiLen + 1;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLen);
      const s: MlRsiRun = {
        rsi, rsiArr: [], closeArr: [], plot0: [], plot1: [], plot2: [], plot3: [], barColors: [],
        steps: [rsi],
        vars: { lastRsi: NaN, lastOb: 70, lastOs: 30, lastPrediction: 'Neutral' },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.rsiArr, s.closeArr, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const c = value(bar);
      const curRsi = s.rsi.step(c);
      s.rsiArr[i] = curRsi;
      s.closeArr[i] = c;
      const { rsiArr, closeArr } = s;
      let ob = NaN;
      let os = NaN;
      knn: if (i >= warmup) {
        if (curRsi == null) break knn;

        const start = Math.max(warmup, i - lookback);
        if (i - start < k + 1) break knn;

        // Find k-nearest historical bars with similar RSI
        const neighbors: { dist: number; rsi: number; priceUp: boolean }[] = [];
        for (let j = start; j < i - 1; j++) {
          const hRsi = rsiArr[j];
          if (hRsi == null) continue;
          const cj = closeArr[j] ?? 0;
          const cj1 = closeArr[j + 1] ?? 0;
          const dist = Math.abs(curRsi - hRsi);
          neighbors.push({ dist, rsi: hRsi, priceUp: cj1 > cj });
        }

        if (neighbors.length < k) break knn;
        neighbors.sort((a, b) => a.dist - b.dist);

        // Compute adaptive thresholds from k nearest neighbors
        let obSum = 0;
        let obCount = 0;
        let osSum = 0;
        let osCount = 0;

        for (let m = 0; m < k; m++) {
          const nb = neighbors[m];
          // Weight by inverse distance (closer neighbors matter more)
          const weight = 1 / (1 + nb.dist);
          if (!nb.priceUp) {
            // Price fell after this RSI value → contributes to OB threshold
            obSum += nb.rsi * weight;
            obCount += weight;
          } else {
            // Price rose after this RSI value → contributes to OS threshold
            osSum += nb.rsi * weight;
            osCount += weight;
          }
        }

        // Default levels if no neighbors in category
        const adaptiveOb = obCount > 0 ? obSum / obCount : 70;
        const adaptiveOs = osCount > 0 ? osSum / osCount : 30;

        // Ensure OB > OS with reasonable bounds
        ob = Math.max(adaptiveOb, adaptiveOs + 5);
        os = Math.min(adaptiveOs, adaptiveOb - 5);

        const v = s.vars;
        v.lastRsi = curRsi;
        v.lastOb = ob;
        v.lastOs = os;
        v.lastPrediction = curRsi >= v.lastOb ? 'Overbought' : curRsi <= v.lastOs ? 'Oversold' : 'Neutral';
      }

      s.plot0[i] = i < warmup || curRsi == null ? { time: bar.time, value: NaN } : { time: bar.time, value: curRsi };
      s.plot1[i] = isNaN(ob) ? { time: bar.time, value: NaN } : { time: bar.time, value: ob };
      s.plot2[i] = isNaN(os) ? { time: bar.time, value: NaN } : { time: bar.time, value: os };
      // 50 level line for fill
      s.plot3[i] = { time: bar.time, value: i < warmup ? NaN : 50 };

      // barcolor: bull (green) when RSI > 50, bear (red) when RSI <= 50
      if (i >= warmup && curRsi != null) {
        s.barColors.push({ time: bar.time, color: curRsi > 50 ? 'rgba(0,255,187,0.8)' : 'rgba(255,17,0,0.8)' });
      }
    },
    result(s) {
      const { lastRsi, lastOb, lastOs, lastPrediction } = s.vars;
      const plot0 = s.plot0.slice();
      // Pine: fill(rsiLine, midLine, finalRsi > 50 ? finalRsi : 50, finalRsi > 50 ? 50 : finalRsi,
      //   neonEffect ? (finalRsi > 50 ? indicatorColor : #00000000) : #00000000,
      //   neonEffect ? (finalRsi > 50 ? #00000000 : indicatorColor) : #00000000)
      // Defaults: neonEffect = true, "Classic", "Trend Following" -> indicatorColor = finalRsi > 50 ? bullColor : bearColor
      const bullColor = '#00FFBB'; // color.rgb(0, 255, 187)
      const bearColor = '#FF1100'; // color.rgb(255, 17, 0)
      const finalRsi = plot0.map(p => p.value);
      const gradient = {
        topValue: finalRsi.map(v => (v > 50 ? v : 50)),
        bottomValue: finalRsi.map(v => (v > 50 ? 50 : v)),
        topColor: finalRsi.map(v => (v > 50 ? bullColor : '#00000000')),
        bottomColor: finalRsi.map(v => (v > 50 ? '#00000000' : bearColor)),
      };

      const predColor = lastPrediction === 'Overbought' ? '#EF5350' : lastPrediction === 'Oversold' ? '#26A69A' : '#D1D4DC';
      const cells: TableCell[] = [
        { row: 0, column: 0, text: 'ML RSI Info', bgColor: '#1E222D', textColor: '#D1D4DC', textSize: 'small' },
        { row: 0, column: 1, text: '', bgColor: '#1E222D' },
        { row: 1, column: 0, text: 'RSI', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
        { row: 1, column: 1, text: isNaN(lastRsi) ? '-' : lastRsi.toFixed(2), bgColor: '#1E222D', textColor: '#2962FF', textSize: 'tiny' },
        { row: 2, column: 0, text: 'Adapt OB', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
        { row: 2, column: 1, text: lastOb.toFixed(2), bgColor: '#1E222D', textColor: '#EF5350', textSize: 'tiny' },
        { row: 3, column: 0, text: 'Adapt OS', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
        { row: 3, column: 1, text: lastOs.toFixed(2), bgColor: '#1E222D', textColor: '#26A69A', textSize: 'tiny' },
        { row: 4, column: 0, text: 'Prediction', bgColor: '#1E222D', textColor: '#787B86', textSize: 'tiny' },
        { row: 4, column: 1, text: lastPrediction, bgColor: '#1E222D', textColor: predColor, textSize: 'tiny' },
      ];

      const table: TableData = {
        position: 'top_right',
        columns: 2,
        rows: 5,
        cells,
      };

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': plot0, 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot3', gradient }],
        hlines: [
          { value: 70, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 30, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
        barColors: s.barColors.slice(),
        tables: [table],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MlRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MlRsiInputs> = {}): Omit<IndicatorResult, 'markers'> & { tables: TableData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MlRsi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
