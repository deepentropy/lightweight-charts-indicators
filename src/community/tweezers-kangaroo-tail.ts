/**
 * Tweezers and Kangaroo Tail
 *
 * Detects tweezer top/bottom and kangaroo tail candlestick patterns.
 * Tweezers compare wick sizes within a lookback window.
 * Kangaroo tails require room (zigzag distance) and wick/body ratio.
 * Alerts (alertcondition, `alerts` of the result): 'Kangaroo Tail Bearish', 'Kangaroo Tail Bullish', 'Tweezers
 * Bearish' and 'Tweezers Bullish', true on the bars of the K / T labels of each kind.
 *
 * Reference: "Tweezer and Kangaroo Tail" by LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TweezersKangarooTailInputs {
  enableTweezer: boolean;
  maxRate: number;
  levelDiff: number;
  tweezPrd: number;
  apartPrd: number;
  enableKangaroo: boolean;
  kangPrd: number;
  kangMinPrd: number;
  atrMult: number;
  wickMult: number;
  wickMultAvg: number;
}

export const defaultInputs: TweezersKangarooTailInputs = {
  enableTweezer: true,
  maxRate: 150,
  levelDiff: 20,
  tweezPrd: 5,
  apartPrd: 12,
  enableKangaroo: true,
  kangPrd: 20,
  kangMinPrd: 8,
  atrMult: 5,
  wickMult: 3,
  wickMultAvg: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'enableTweezer', type: 'bool', title: 'Enable Tweezer', defval: true },
  { id: 'maxRate', type: 'float', title: 'Max Rate % Between Wick Sizes', defval: 150, min: 1, step: 10 },
  { id: 'levelDiff', type: 'float', title: 'Max Difference in level %', defval: 20, min: 1, step: 5 },
  { id: 'tweezPrd', type: 'int', title: 'Highest/Lowest Period', defval: 5, min: 1 },
  { id: 'apartPrd', type: 'int', title: 'Max Distance between Tweezers', defval: 12, min: 1 },
  { id: 'enableKangaroo', type: 'bool', title: 'Enable Kangaroo Tail', defval: true },
  { id: 'kangPrd', type: 'int', title: 'Period for Room', defval: 20, min: 2, max: 50 },
  { id: 'kangMinPrd', type: 'int', title: 'Minimum Period for Room', defval: 8, min: 2, max: 50 },
  { id: 'atrMult', type: 'int', title: 'ATR Factor for Room Height', defval: 5, min: 2, max: 30 },
  { id: 'wickMult', type: 'float', title: 'Wick/Body Rate', defval: 3, min: 1, step: 0.5 },
  { id: 'wickMultAvg', type: 'float', title: 'Wick/Average_Wick Rate', defval: 2, min: 1, step: 0.5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Placeholder', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Tweezers & Kangaroo Tail',
  shortTitle: 'Tweez/Kang',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TweezVars {
  /** zigzag stores [value0, barIndex0, value1, barIndex1] (changed in place, copied by copyVars) */
  zigzag: number[];
  dir: number;
  prevDir: number;
}

interface TweezRun extends BarRunState<TweezVars> {
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  highestKang: ReturnType<typeof taStep.highest>;
  lowestKang: ReturnType<typeof taStep.lowest>;
  atr: ReturnType<typeof taStep.atr>;
  avgTopWick: ReturnType<typeof taStep.sma>;
  topWick: number[];
  bottomWick: number[];
  highestArr: number[];
  lowestArr: number[];
  closePlot: { time: number; value: number }[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TweezersKangarooTailInputs>): BarStudy<TweezRun, Result> {
  const {
    enableTweezer, maxRate: maxRatePct, levelDiff: levelDiffPct, tweezPrd, apartPrd,
    enableKangaroo, kangPrd, kangMinPrd, atrMult, wickMult, wickMultAvg,
  } = { ...defaultInputs, ...inputs };
  const maxRate = maxRatePct / 100;
  const levelDiffRate = levelDiffPct / 100;
  const flags = [false, false, false, false];
  const isHighestBar = (s: TweezRun, bars: Bar[], j: number) => j >= tweezPrd - 1 && bars[j].high === s.highestArr[j];
  const isLowestBar = (s: TweezRun, bars: Bar[], j: number) => j >= tweezPrd - 1 && bars[j].low === s.lowestArr[j];
  return {
    init() {
      const highest = taStep.highest();
      const lowest = taStep.lowest();
      const highestKang = taStep.highest();
      const lowestKang = taStep.lowest();
      // ATR for kangaroo tail; average top wick size (SMA 50)
      const atr = taStep.atr(50);
      const avgTopWick = taStep.sma();
      const s: TweezRun = {
        highest, lowest, highestKang, lowestKang, atr, avgTopWick,
        topWick: [], bottomWick: [], highestArr: [], lowestArr: [], closePlot: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [highest, lowest, highestKang, lowestKang, atr, avgTopWick],
        vars: { zigzag: [0, 0, 0, 0], dir: 0, prevDir: 0 },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.topWick, s.bottomWick, s.highestArr, s.lowestArr, s.closePlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { open, high, low, close, time } = bars[i];
      const v = s.vars;
      // wick/body data
      const topWick = high - Math.max(close, open);
      const bottomWick = Math.min(close, open) - low;
      const body = Math.abs(close - open);
      s.topWick[i] = topWick;
      s.bottomWick[i] = bottomWick;
      // Highest/lowest detection for tweezers
      s.highestArr[i] = s.highest.step(high, tweezPrd);
      s.lowestArr[i] = s.lowest.step(low, tweezPrd);
      const atrNow = s.atr.step(high, low, close);
      const avgTopWickNow = s.avgTopWick.step(topWick, 50);
      // Highest/lowest for kangaroo prd
      const highestKang = s.highestKang.step(high, kangPrd);
      const lowestKang = s.lowestKang.step(low, kangPrd);
      s.closePlot[i] = { time, value: NaN };
      let topKangaroo = false;
      let bottomKangaroo = false;
      let topTweezer = false;
      let bottomTweezer = false;

      // --- TWEEZERS ---
      if (enableTweezer && i >= tweezPrd) {
        // Top tweezer
        if (topWick > 0 && isHighestBar(s, bars, i)) {
          for (let x = 1; x <= Math.min(apartPrd, i); x++) {
            if (s.topWick[i - x] === 0) break;
            const maxW = Math.max(topWick, s.topWick[i - x]);
            const minW = Math.min(topWick, s.topWick[i - x]);
            if (maxW / minW <= maxRate && Math.abs(high - bars[i - x].high) < maxW * levelDiffRate && isHighestBar(s, bars, i - x)) {
              s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'T' });
              topTweezer = true;
              break;
            } else if (bars[i - x].high >= high) {
              break;
            }
          }
        }
        // Bottom tweezer
        if (bottomWick > 0 && isLowestBar(s, bars, i)) {
          for (let x = 1; x <= Math.min(apartPrd, i); x++) {
            if (s.bottomWick[i - x] === 0) break;
            const maxW = Math.max(bottomWick, s.bottomWick[i - x]);
            const minW = Math.min(bottomWick, s.bottomWick[i - x]);
            if (maxW / minW <= maxRate && Math.abs(low - bars[i - x].low) < maxW * levelDiffRate && isLowestBar(s, bars, i - x)) {
              s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'T' });
              bottomTweezer = true;
              break;
            } else if (bars[i - x].low <= low) {
              break;
            }
          }
        }
      }

      // --- KANGAROO TAIL ---
      if (enableKangaroo && i >= kangPrd) {
        const ph = high === highestKang ? high : NaN;
        const pl = low === lowestKang ? low : NaN;
        v.prevDir = v.dir;
        if (!isNaN(ph) && isNaN(pl)) v.dir = 1;
        else if (!isNaN(pl) && isNaN(ph)) v.dir = -1;
        const dir = v.dir;
        const dirChanged = dir !== v.prevDir;
        if (!isNaN(ph) || !isNaN(pl)) {
          const val = dir === 1 ? ph : pl;
          if (!isNaN(val)) {
            if (dirChanged) {
              // add_to_zigzag: unshift value, barIndex; pop last two
              v.zigzag = [val, i, v.zigzag[0], v.zigzag[1]];
            } else {
              // update_zigzag: if new extreme, update
              if ((dir === 1 && val > v.zigzag[0]) || (dir === -1 && val < v.zigzag[0])) {
                v.zigzag[0] = val;
                v.zigzag[1] = i;
              }
            }
          }
        }
        const zigzag = v.zigzag;
        const atrVal = atrNow ?? 0;
        const avgWick = avgTopWickNow ?? 0;
        const prevHigh = i > 0 ? bars[i - 1].high : high;
        const prevLow = i > 0 ? bars[i - 1].low : low;
        // Top kangaroo (bearish)
        if (dir === 1 && topWick >= body * wickMult &&
          close <= low + (high - low) / 3 && open <= low + (high - low) / 3 &&
          open < prevHigh && open > prevLow && close < prevHigh && close > prevLow &&
          topWick >= wickMultAvg * avgWick && body > 0 &&
          !isNaN(ph) && zigzag[0] === high &&
          zigzag[0] - zigzag[2] > atrVal * atrMult &&
          zigzag[1] - zigzag[3] > kangMinPrd) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'K' });
          topKangaroo = true;
        }
        // Bottom kangaroo (bullish)
        if (dir === -1 && bottomWick >= body * wickMult &&
          close >= high - (high - low) / 3 && open >= high - (high - low) / 3 &&
          open < prevHigh && open > prevLow && close < prevHigh && close > prevLow &&
          bottomWick >= wickMultAvg * avgWick && body > 0 &&
          !isNaN(pl) && zigzag[0] === low &&
          zigzag[2] - zigzag[0] > atrVal * atrMult &&
          zigzag[1] - zigzag[3] > kangMinPrd) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'K' });
          bottomKangaroo = true;
        }
      }
      // alertcondition(topkangaroo) / (bottomkangaroo) / (top_tweezer) / (bottom_tweezer)
      flags[0] = topKangaroo;
      flags[1] = bottomKangaroo;
      flags[2] = topTweezer;
      flags[3] = bottomTweezer;
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    copyVars: (v) => ({ ...v, zigzag: v.zigzag.slice() }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.closePlot.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TweezersKangarooTailInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TweezersKangarooTailInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Kangaroo Tail Bearish', message: 'Kangaroo Tail Bearish' },
  { id: 'alert1', title: 'Kangaroo Tail Bullish', message: 'Kangaroo Tail Bullish' },
  { id: 'alert2', title: 'Tweezers Bearish', message: 'Tweezers Bearish' },
  { id: 'alert3', title: 'Tweezers Bullish', message: 'Tweezers Bullish' },
];

export const TweezersKangarooTail = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
