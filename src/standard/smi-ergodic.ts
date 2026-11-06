/**
 * SMI Ergodic Indicator
 *
 * A momentum oscillator based on True Strength Index.
 * SMI = EMA(EMA(pc, longLen), shortLen) / EMA(EMA(|pc|, longLen), shortLen)
 * Signal = EMA(SMI, signalLen)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SMIErgodicInputs {
  /** Long period */
  longLength: number;
  /** Short period */
  shortLength: number;
  /** Signal period */
  signalLength: number;
}

export const defaultInputs: SMIErgodicInputs = {
  longLength: 20,
  shortLength: 5,
  signalLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 20, min: 1 },
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 5, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Line Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'SMI Ergodic Indicator',
  shortTitle: 'SMII',
  overlay: false,
};

type Point = { time: number; value: number };
type Ema = ReturnType<typeof taStep.ema>;

interface SmiRun extends BarRunState<Record<string, never>> {
  firstPC: Ema;
  doublePC: Ema;
  firstAbsPC: Ema;
  doubleAbsPC: Ema;
  signal: Ema;
  smiData: Point[];
  signalData: Point[];
}

function study(inputs: Partial<SMIErgodicInputs>): BarStudy<SmiRun, IndicatorResult> {
  const { longLength, shortLength, signalLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const firstPC = taStep.ema(longLength);
      const doublePC = taStep.ema(shortLength);
      const firstAbsPC = taStep.ema(longLength);
      const doubleAbsPC = taStep.ema(shortLength);
      const signal = taStep.ema(signalLength);
      const s: SmiRun = {
        firstPC, doublePC, firstAbsPC, doubleAbsPC, signal, smiData: [], signalData: [],
        steps: [firstPC, doublePC, firstAbsPC, doubleAbsPC, signal], vars: {}, lists: [], series: [],
      };
      s.series = [s.smiData, s.signalData];
      return s;
    },
    bar(s, i, bars) {
      // Price change and absolute price change
      const pc = i > 0 ? bars[i].close - bars[i - 1].close : NaN;
      const absPC = isNaN(pc) ? NaN : Math.abs(pc);

      // Double smooth: EMA(EMA(src, longLen), shortLen) — per PineScript ta.tsi()
      const dsPC = s.doublePC.step(s.firstPC.step(pc));
      const dsAbsPC = s.doubleAbsPC.step(s.firstAbsPC.step(absPC));

      // SMI = doubleSmoothPC / doubleSmoothAbsPC (ta.tsi returns raw ratio, no 100x)
      const smi = dsPC == null || dsAbsPC == null || dsAbsPC === 0 ? NaN : dsPC / dsAbsPC;

      // Signal = EMA(SMI, signalLength)
      const signal = s.signal.step(smi);

      s.smiData[i] = { time: bars[i].time, value: smi ?? NaN };
      s.signalData[i] = { time: bars[i].time, value: signal ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.smiData.slice(),
          'plot1': s.signalData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SMIErgodicInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SMIErgodicInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SMIErgodic = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
