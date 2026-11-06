/**
 * Slow Heiken Ashi
 *
 * As the original: the SMAs over "Period" of open / high / low / close (Om, Hm, Lm, Cm) give vClose = their mean;
 * vOpen is a KAMA of vClose[1] (fastend / slowend, length 1/2: an integer division, 0 bars, so the efficiency ratio
 * is 1 and the smoothing constant fastend^2); vHigh = max(Hm, vClose, vOpen), vLow = min(Lm, vClose, vOpen).
 * Candles red when vOpen > vClose, green otherwise (wick / border: the plotcandle defaults). With "Signal" on: a
 * white '▼' at vHigh when vOpen crosses above vClose (char0), a white '▲' at vLow when it crosses below (char1).
 * The original has no alerts.
 *
 * Reference: "Slow Heiken Ashi" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface SlowHeikenAshiInputs {
  /** Period of the SMAs */
  length: number;
  fastend: number;
  slowend: number;
  signal: boolean;
}

export const defaultInputs: SlowHeikenAshiInputs = {
  length: 6,
  fastend: 0.666,
  slowend: 0.0645,
  signal: true,
};

// Untitled inputs keep their variable names as titles
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Period', defval: 6 },
  { id: 'fastend', type: 'float', title: 'fastend', defval: 0.666, step: 0.001 },
  { id: 'slowend', type: 'float', title: 'slowend', defval: 0.0645, step: 0.0001 },
  { id: 'signal', type: 'bool', title: 'Signal', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candle0', title: 'PlotCandle' },
];

export const metadata = {
  title: 'Slow Heiken Ashi',
  shortTitle: 'SlowHA',
  overlay: true,
};

/** Pine version 1 colours */
const RED = '#FF0000';
const GREEN = '#008000';
const WHITE = '#FFFFFF';
/** plotcandle defaults of wickcolor / bordercolor */
const WICK = '#737375';
const BORDER = '#000000';

/** hakamaper = 1/2: a division of two integer constants (0) */
const HA_KAMA_PER = Math.trunc(1 / 2);

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; markers: MarkerData[] };

interface SlowHaRun extends BarRunState<Record<string, never>> {
  om: WindowSma;
  hm: WindowSma;
  lm: WindowSma;
  cm: WindowSma;
  /** kama input (vClose[1]), its abs(x - x[1]) and the kama output (vOpen) */
  x: number[];
  diff: number[];
  vOpen: number[];
  vClose: number[];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<SlowHeikenAshiInputs>): BarStudy<SlowHaRun, Result> {
  const { length, fastend, slowend, signal } = { ...defaultInputs, ...inputs };
  const amaLength = HA_KAMA_PER;
  return {
    init() {
      const om = new WindowSma(length);
      const hm = new WindowSma(length);
      const lm = new WindowSma(length);
      const cm = new WindowSma(length);
      const s: SlowHaRun = {
        om, hm, lm, cm, x: [], diff: [], vOpen: [], vClose: [], candles: [], markers: [],
        steps: [om, hm, lm, cm], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.x, s.diff, s.vOpen, s.vClose, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hm = s.hm.step(b.high);
      const lm = s.lm.step(b.low);
      const om = s.om.step(b.open);
      const cm = s.cm.step(b.close);
      const vClose = (om + hm + lm + cm) / 4;
      s.vClose[i] = vClose;

      // kama(close, amaLength) of the original, on vClose[1]
      const x = s.x;
      const xi = i > 0 ? s.vClose[i - 1] : NaN;
      x[i] = xi;
      s.diff[i] = i > 0 ? Math.abs(xi - x[i - 1]) : NaN;
      const sig = Math.abs(xi - (i - amaLength >= 0 ? x[i - amaLength] : NaN));
      let noise = 0;
      for (let k = 0; k < amaLength; k++) noise += i - k >= 0 ? s.diff[i - k] : NaN;
      if (amaLength > 0 && i < amaLength - 1) noise = NaN;
      const efratio = noise !== 0 && Number.isFinite(noise) ? sig / noise : 1;
      const smooth = Math.pow(efratio * (fastend - slowend) + slowend, 2);
      const prev = i > 0 ? s.vOpen[i - 1] : NaN;
      const base = Number.isFinite(prev) ? prev : xi;
      const vOpen = base + smooth * (xi - base);
      s.vOpen[i] = vOpen;

      // math.max / math.min with an na argument: na
      const vHigh = Math.max(hm, vClose, vOpen);
      const vLow = Math.min(lm, vClose, vOpen);

      const time = b.time as number;
      const ok = Number.isFinite(vOpen) && Number.isFinite(vHigh) && Number.isFinite(vLow) && Number.isFinite(vClose);
      if (!ok) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        s.candles[i] = {
          time, open: vOpen, high: vHigh, low: vLow, close: vClose,
          color: vOpen > vClose ? RED : GREEN, wickColor: WICK, borderColor: BORDER,
        };
      }

      // cross(vOpen, vClose) and vOpen[1] < vClose[1] -> '▼' at vHigh; and vOpen[1] > vClose[1] -> '▲' at vLow
      if (signal && i >= 1) {
        const o = vOpen, c = vClose, po = s.vOpen[i - 1], pc = s.vClose[i - 1];
        const cross = (o > c && po <= pc) || (o < c && po >= pc);
        if (cross && po < pc && Number.isFinite(vHigh)) {
          s.markers.push({ id: 'char0', time: b.time, position: 'atPriceMiddle', price: vHigh, shape: 'circle', char: '▼', color: WHITE });
        }
        if (cross && po > pc && Number.isFinite(vLow)) {
          s.markers.push({ id: 'char1', time: b.time, position: 'atPriceMiddle', price: vLow, shape: 'circle', char: '▲', color: WHITE });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candle0: s.candles.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SlowHeikenAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SlowHeikenAshiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SlowHeikenAshi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
