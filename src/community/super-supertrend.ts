/**
 * Super SuperTrend Three Line
 *
 * Three SuperTrend lines at different ATR multipliers for layered
 * trend confirmation. Arrows (the original's plotarrow outputs, `arrows` of the result) on each trend flip, and
 * shapes at the bottom of the pane where the close crosses each line.
 *
 * Reference: "Super SuperTrend" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperSupertrendInputs {
  atrLen: number;
  mult1: number;
  mult2: number;
  mult3: number;
}

export const defaultInputs: SuperSupertrendInputs = {
  atrLen: 10,
  mult1: 1.0,
  mult2: 2.0,
  mult3: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'mult1', type: 'float', title: 'Multiplier 1', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'mult2', type: 'float', title: 'Multiplier 2', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'mult3', type: 'float', title: 'Multiplier 3', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ST1', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'ST2', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'ST3', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Super SuperTrend',
  shortTitle: 'SST',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[]; plotCandles: Record<string, PlotCandleData[]> };

interface SstRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  /** SuperTrend line and direction of each multiplier, per bar */
  st: number[][];
  dir: number[][];
  plots: Point[][];
  markers: MarkerData[];
  arrows: ArrowData[];
  candles: PlotCandleData[];
}

const LIME = '#00FF00', RED = '#FF0000', YELLOW = '#FFFF00', GREEN = '#008000';
// Shapes at the bottom (plotshape outputs): close crossing over (under) each line, ids shape0..shape5 in the
// original's order (UpShape1 / DownShape1 for ST1, UpShape2 / DownShape2 for ST2, UpShape1 / DownShape2 for ST3)
const allSTs = [
  { up: 'shape0', down: 'shape1', upShape: 'flag' as const, upColor: YELLOW, arrowUp: 'arrow0', arrowDn: 'arrow1' },
  { up: 'shape2', down: 'shape3', upShape: 'triangleUp' as const, upColor: GREEN, arrowUp: 'arrow2', arrowDn: 'arrow3' },
  { up: 'shape4', down: 'shape5', upShape: 'triangleUp' as const, upColor: GREEN, arrowUp: 'arrow4', arrowDn: 'arrow5' },
];

function study(inputs: Partial<SuperSupertrendInputs>): BarStudy<SstRun, Result> {
  const { atrLen, mult1, mult2, mult3 } = { ...defaultInputs, ...inputs };
  const mults = [mult1, mult2, mult3];
  const warmup = atrLen;

  return {
    init() {
      const atr = taStep.atr(atrLen);
      const s: SstRun = {
        atr, st: [[], [], []], dir: [[], [], []], plots: [[], [], []], markers: [], arrows: [], candles: [],
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.arrows];
      s.series = [...s.st, ...s.dir, ...s.plots, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const atrVal = s.atr.step(b.high, b.low, b.close);
      for (let k = 0; k < 3; k++) {
        const st = s.st[k];
        const dir = s.dir[k];
        // calcSuperTrend
        const hl2 = (b.high + b.low) / 2;
        const atr = (atrVal ?? 0) * mults[k];
        const up = hl2 - atr;
        const dn = hl2 + atr;

        if (i === 0) {
          st[i] = up;
          dir[i] = 1;
        } else {
          const prevDir = dir[i - 1];
          const prevSt = st[i - 1];
          const close = b.close;
          const prevClose = bars[i - 1].close;

          // Trailing logic
          const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
          const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

          if (prevDir === 1) {
            // Was bullish
            if (close < trailUp) {
              dir[i] = -1;
              st[i] = trailDn;
            } else {
              dir[i] = 1;
              st[i] = trailUp;
            }
          } else {
            // Was bearish
            if (close > trailDn) {
              dir[i] = 1;
              st[i] = trailUp;
            } else {
              dir[i] = -1;
              st[i] = trailDn;
            }
          }
        }
        s.plots[k][i] = i < warmup ? { time, value: NaN } : { time, value: st[i], color: dir[i] === 1 ? '#26A69A' : '#EF5350' };
      }

      // Arrows (the original's plotarrow outputs, `arrows` of the result):
      // plotarrow(TrendK == 1 and TrendK[1] == -1 ? TrendK : na, "UpSTArrowK", colorup = lime, transp = 0)
      // plotarrow(TrendK == -1 and TrendK[1] == 1 ? TrendK : na, "DnSTArrowK", colordown = red, transp = 0)
      if (i >= warmup + 1) {
        for (let k = 0; k < 3; k++) {
          const { up, down, upShape, upColor, arrowUp, arrowDn } = allSTs[k];
          const st = s.st[k];
          const dir = s.dir[k];
          // Trend flip arrows
          if (dir[i] === 1 && dir[i - 1] === -1) {
            s.arrows.push({ time, id: arrowUp, value: 1, color: LIME });
          } else if (dir[i] === -1 && dir[i - 1] === 1) {
            s.arrows.push({ time, id: arrowDn, value: -1, color: RED });
          }

          // cross(close, Tsl) and close > Tsl / cross(Tsl, close) and close < Tsl
          const close = b.close;
          const prevClose = bars[i - 1].close;
          const stVal = st[i];
          const prevStVal = st[i - 1];
          const crossAbove = close > stVal && prevClose <= prevStVal;
          const crossBelow = close < stVal && prevClose >= prevStVal;
          if (crossAbove) s.markers.push({ time, position: 'bottom', shape: upShape, color: upColor, id: up });
          if (crossBelow) s.markers.push({ time, position: 'bottom', shape: 'triangleDown', color: RED, id: down });
        }
      }

      // plotCandles: Pine plots regular OHLC candles colored by trend
      // plotcandle(open, high, low, close, color=(open < close) ? green : red, wickcolor=gray)
      s.candles[i] = {
        time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        color: b.open < b.close ? '#26A69A' : '#EF5350',
        wickColor: '#787B86',
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plots[0].slice(),
          'plot1': s.plots[1].slice(),
          'plot2': s.plots[2].slice(),
        },
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
        plotCandles: { candle0: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperSupertrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperSupertrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SuperSupertrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
