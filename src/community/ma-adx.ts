/**
 * Moving Average ADX
 *
 * MA that colors based on ADX strength. Green when ADX > threshold (trending),
 * gray otherwise (ranging).
 *
 * Reference: "Moving Average ADX" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAADXInputs {
  maLength: number;
  adxLength: number;
  adxThreshold: number;
  src: SourceType;
}

export const defaultInputs: MAADXInputs = {
  maLength: 34,
  adxLength: 14,
  adxThreshold: 18,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 34, min: 1 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'adxThreshold', type: 'int', title: 'ADX MA Active', defval: 18, min: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average ADX',
  shortTitle: 'MAADX',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface AdxVars {
  smoothTR: number;
  smoothPlusDM: number;
  smoothMinusDM: number;
  adx: number;
}

interface MaAdxRun extends BarRunState<AdxVars> {
  wma: ReturnType<typeof taStep.wma>;
  plot: Point[];
}

function study(inputs: Partial<MAADXInputs>): BarStudy<MaAdxRun, IndicatorResult> {
  const { maLength, adxLength, adxThreshold, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(maLength, 2 * adxLength);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const wma = taStep.wma();
      const s: MaAdxRun = {
        wma, plot: [], steps: [wma], vars: { smoothTR: 0, smoothPlusDM: 0, smoothMinusDM: 0, adx: 0 }, lists: [], series: [],
      };
      s.series = [s.plot];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const wma = s.wma.step(value(bars[i]), maLength);

      // Calculate ADX + DI+/DI- manually using Wilder's smoothing
      const high = bars[i].high;
      const low = bars[i].low;
      const prevHigh = i > 0 ? bars[i - 1].high : high;
      const prevLow = i > 0 ? bars[i - 1].low : low;
      const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      const plusDM = (high - prevHigh > prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = (prevLow - low > high - prevHigh) ? Math.max(prevLow - low, 0) : 0;

      if (i <= adxLength) {
        v.smoothTR += tr;
        v.smoothPlusDM += plusDM;
        v.smoothMinusDM += minusDM;
      } else {
        v.smoothTR = v.smoothTR - v.smoothTR / adxLength + tr;
        v.smoothPlusDM = v.smoothPlusDM - v.smoothPlusDM / adxLength + plusDM;
        v.smoothMinusDM = v.smoothMinusDM - v.smoothMinusDM / adxLength + minusDM;
      }

      const diPlus = v.smoothTR !== 0 ? (v.smoothPlusDM / v.smoothTR) * 100 : 0;
      const diMinus = v.smoothTR !== 0 ? (v.smoothMinusDM / v.smoothTR) * 100 : 0;
      const diSum = diPlus + diMinus;
      const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

      if (i === 2 * adxLength - 1) {
        v.adx = dx;
      } else if (i >= 2 * adxLength) {
        v.adx = (v.adx * (adxLength - 1) + dx) / adxLength;
      }
      const adx = v.adx;

      // Pine: lime when ADX > threshold AND plus > minus, red when ADX > threshold AND plus < minus, black otherwise
      const t = bars[i].time;
      if (i < warmup) {
        s.plot[i] = { time: t, value: NaN };
        return;
      }
      let color = '#000000'; // black (ranging)
      if (adx > adxThreshold && diPlus > diMinus) {
        color = '#00FF00'; // lime (bullish trend)
      } else if (adx > adxThreshold && diPlus < diMinus) {
        color = '#FF0000'; // red (bearish trend)
      }
      s.plot[i] = { time: t, value: wma, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAADXInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAADXInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MAADX = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
