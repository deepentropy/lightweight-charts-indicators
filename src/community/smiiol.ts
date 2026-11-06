/**
 * SMIIOL
 *
 * SMI Ergodic: the indicator is the true strength index of the close (ta.tsi with the short and long periods), the
 * signal is its EMA and the oscillator histogram is indicator - signal. A Buy triangle at the bottom of the pane marks
 * the bar after the indicator crosses over the lower band (-band line) when the HMA of the close is rising.
 * Horizontal lines at -band line and +band line.
 *
 * Reference: "SMIIOL" by iilter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © iilter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface SmiiolInputs {
  /** TSI short period */
  shortlength: number;
  /** TSI long period */
  longlength: number;
  /** Signal EMA period */
  signallength: number;
  /** HMA period */
  hmalength: number;
  /** Band line (+/-) */
  bandLine: number;
}

export const defaultInputs: SmiiolInputs = {
  shortlength: 5,
  longlength: 24,
  signallength: 5,
  hmalength: 18,
  bandLine: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortlength', type: 'int', title: 'Short Period', defval: 5 },
  { id: 'longlength', type: 'int', title: 'Long Period', defval: 24 },
  { id: 'signallength', type: 'int', title: 'Signal Line Period', defval: 5 },
  { id: 'hmalength', type: 'int', title: 'HMA Period', defval: 18 },
  { id: 'bandLine', type: 'float', title: 'Band Line (+/-)', defval: 0.35 },
];

const IND_COL = String(color.rgb(11, 230, 33));
const SIG_COL = String(color.rgb(236, 25, 25));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Indicator', color: IND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: SIG_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Oscillator', color: color.red, lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'SMIIOL',
  shortTitle: 'SMIIOL',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color: string };
type Ema = ReturnType<typeof taStep.ema>;

interface SmiiolRun extends BarRunState<Record<string, never>> {
  momLong: Ema;
  momShort: Ema;
  absLong: Ema;
  absShort: Ema;
  sig: Ema;
  hma: ReturnType<typeof taStep.hma>;
  cross: ReturnType<typeof taStep.crossover>;
  co97: boolean[];
  hmaArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<SmiiolInputs>): BarStudy<SmiiolRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyCol = String(color.rgb(15, 231, 15));
  const buyText = String(color.rgb(227, 236, 229));
  return {
    init(bars) {
      // ergonic = ta.tsi(close, shortlength, longlength): ema(ema(change, long), short) / ema(ema(|change|, long), short)
      const momLong = taStep.ema(cfg.longlength);
      const momShort = taStep.ema(cfg.shortlength);
      const absLong = taStep.ema(cfg.longlength);
      const absShort = taStep.ema(cfg.shortlength);
      const sig = taStep.ema(cfg.signallength);
      // ta.hma(close, 1) runs ta.wma(close, 0): a Pine runtime error
      if (Math.floor(cfg.hmalength / 2) < 1 && bars.length > 0) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      const s: SmiiolRun = {
        momLong, momShort, absLong, absShort, sig, hma: taStep.hma(cfg.hmalength), cross: taStep.crossover(),
        co97: [], hmaArr: [], plot0: [], plot1: [], plot2: [], markers: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [momLong, momShort, absLong, absShort, sig, s.hma, s.cross];
      s.lists = [s.markers];
      s.series = [s.co97, s.hmaArr, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const momentum = i > 0 ? b.close - bars[i - 1]!.close : NaN;
      const m = s.momShort.step(s.momLong.step(momentum));
      const d = s.absShort.step(s.absLong.step(Math.abs(momentum)));
      // a value in [-1, 1]; a division by zero is na
      const ergonic = d === 0 ? NaN : m / d;
      // signal = ta.ema(ergonic, signallength)
      const signal = s.sig.step(ergonic);
      const oscillator = ergonic - signal;
      const hma = s.hma.step(b.close);
      s.hmaArr[i] = hma;
      // co97 = ta.crossover(ergonic, -bandLine)
      s.co97[i] = s.cross.step(ergonic, -cfg.bandLine);
      // buy97 = co97[1] and (hma > hma[1])
      if (i >= 1 && s.co97[i - 1] && gt(hma, s.hmaArr[i - 1]!)) {
        s.markers.push({ time: b.time, position: 'bottom', shape: 'triangleUp', color: buyCol, text: '',
          textColor: buyText, size: 'tiny' });
      }
      s.plot0[i] = { time, value: ergonic, color: IND_COL };
      s.plot1[i] = { time, value: signal, color: SIG_COL };
      s.plot2[i] = { time, value: oscillator, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: -cfg.bandLine, options: { title: 'SMIIOL Lower Band', color: '#e7350d', linestyle: 'dashed' } },
          { value: cfg.bandLine, options: { title: 'SMIIOL Upper Band', color: '#5cf10c', linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmiiolInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmiiolInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Smiiol = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
