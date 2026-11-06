/**
 * Matrix Series
 *
 * Oscillator drawn as candles: ys1 = (high + low + 2 close) / 4, rk5 = (ys1 - ema(ys1)) * 200 / stdev(ys1),
 * up = ema(ema(rk5)), down = ema(up) (all over the Smoother length). Each series exists from the first bar where
 * its input series exists (rk5 from bar Smoother - 1, up from 3 x (Smoother - 1), down from 4 x (Smoother - 1)).
 * Dynamic zones: highest / lowest of cci(close, Price Period) over the Sup/Res Period, as two lines. OB/OS
 * crosses above / below the candles past the Overbought / Oversold levels, and two optional level lines. Colours
 * of the original's Pine version: green #008000 (up > down candles, resistance line) and red #FF0000.
 *
 * Reference: "Matrix Series" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MatrixSeriesInputs {
  smoother: number;
  supResPeriod: number;
  supResPercentage: number;
  pricePeriod: number;
  ob: number;
  os: number;
  showOBOS: boolean;
  dynamic: boolean;
}

export const defaultInputs: MatrixSeriesInputs = {
  smoother: 5,
  supResPeriod: 50,
  supResPercentage: 100,
  pricePeriod: 16,
  ob: 200,
  os: -200,
  showOBOS: false,
  dynamic: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoother', type: 'int', title: 'Smoother', defval: 5, min: 1 },
  { id: 'supResPeriod', type: 'int', title: 'Sup/Res Period', defval: 50, min: 1 },
  { id: 'supResPercentage', type: 'int', title: 'Sup/Res Percentage', defval: 100, min: 1 },
  { id: 'pricePeriod', type: 'int', title: 'Price Period', defval: 16, min: 1 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 200 },
  { id: 'os', type: 'int', title: 'Oversold', defval: -200 },
  { id: 'showOBOS', type: 'bool', title: 'Show OB/OS', defval: false },
  { id: 'dynamic', type: 'bool', title: 'Dynamic Zones', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'resistance', title: 'Resistance Line', color: '#008000', lineWidth: 1 },
  { id: 'support', title: 'Support Line', color: '#FF0000', lineWidth: 1 },
  { id: 'obMarker', title: 'OB Cross', color: '#00FFFF', lineWidth: 2, style: 'cross' },
  { id: 'osMarker', title: 'OS Cross', color: '#00FFFF', lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Matrix Series',
  shortTitle: 'MTX',
  overlay: false,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: { candle0: PlotCandleData[] } };

interface MatrixRun extends BarRunState<Record<string, never>> {
  rk3: ReturnType<typeof taStep.ema>;
  rk4: WindowStdev;
  rk6: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.ema>;
  down: ReturnType<typeof taStep.ema>;
  cci: ReturnType<typeof taStep.cci>;
  cciArr: number[];
  candles: PlotCandleData[];
  resistancePlot: Point[];
  supportPlot: Point[];
  obMarkerPlot: Point[];
  osMarkerPlot: Point[];
}

function study(inputs: Partial<MatrixSeriesInputs>): BarStudy<MatrixRun, Result> {
  const { smoother, supResPeriod, supResPercentage, pricePeriod, ob, os, showOBOS, dynamic } = { ...defaultInputs, ...inputs };
  const nn = smoother;
  return {
    init() {
      const s: MatrixRun = {
        rk3: taStep.ema(nn), rk4: new WindowStdev(nn), rk6: taStep.ema(nn), up: taStep.ema(nn), down: taStep.ema(nn),
        cci: taStep.cci(pricePeriod), cciArr: [], candles: [], resistancePlot: [], supportPlot: [], obMarkerPlot: [],
        osMarkerPlot: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rk3, s.rk4, s.rk6, s.up, s.down, s.cci];
      s.series = [s.cciArr, s.candles, s.resistancePlot, s.supportPlot, s.obMarkerPlot, s.osMarkerPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Pine: ys1 = (high+low+close*2)/4, then series of EMA/stdev transforms
      const ys1Val = (b.high + b.low + b.close * 2) / 4;
      const r3 = s.rk3.step(ys1Val);
      const r4 = s.rk4.step(ys1Val);
      // na while ema / stdev warm up; a division by a zero stdev is na
      const rk5 = (r4 !== 0 && !isNaN(r4) && !isNaN(r3)) ? (ys1Val - r3) * 200 / r4 : NaN;
      const rk6 = s.rk6.step(rk5);
      const up = s.up.step(rk6);
      const dn = s.down.step(up);

      // Pine: plotcandle(Oo,Hh,Ll,Cc,color=vcolor)
      if (isNaN(up) || isNaN(dn)) {
        s.candles[i] = { time, open: NaN, high: NaN, low: NaN, close: NaN };
      } else {
        // Pine: Oo = iff(up<down, up, down), Hh=Oo, Ll=iff(up<down, down, up), Cc=Ll
        // vcolor = Oo > Cc ? red : up > down ? green : red
        const Oo = up < dn ? up : dn;
        const Ll = up < dn ? dn : up;
        const color = up > dn ? '#008000' : '#FF0000';
        s.candles[i] = { time, open: Oo, high: Oo, low: Ll, close: Ll, color };
      }

      // -------S/R Zones------
      // Pine: C3 = cci(close, Pds) — uses close as source, not hlc3
      s.cciArr[i] = s.cci.step(b.close);
      // highest / lowest over the last Lookback bars (na values skipped), na until the window is full
      let value2 = NaN;
      let value3 = NaN;
      if (i >= supResPeriod - 1) {
        let hi = NaN, lo = NaN;
        for (let k = i - supResPeriod + 1; k <= i; k++) {
          const v = s.cciArr[k];
          if (v == null || isNaN(v)) continue;
          if (isNaN(hi) || v > hi) hi = v;
          if (isNaN(lo) || v < lo) lo = v;
        }
        value2 = hi;
        value3 = lo;
      }

      // Pine: ResistanceLine = Value3 + Value5, SupportLine = Value2 - Value5
      if (!dynamic || isNaN(value2) || isNaN(value3)) {
        s.resistancePlot[i] = { time, value: NaN };
        s.supportPlot[i] = { time, value: NaN };
      } else {
        const v4 = value2 - value3;
        const v5 = v4 * (supResPercentage / 100);
        s.resistancePlot[i] = { time, value: value3 + v5 };
        s.supportPlot[i] = { time, value: value2 - v5 };
      }

      // --Overbought/Oversold/Warning Detail
      // Pine: UPshape = up > ob and up>down ? highest(up,1)+20 : up>ob and up<down ? highest(down,1)+20 : na
      // Pine: DOWNshape = down < os and up>down ? lowest(down,1)-20 : down<os and up<down ? lowest(up,1)-20 : na
      // Pine: plot(UPshape, style=cross, color=aqua, linewidth=2)
      // Pine: plot(DOWNshape, style=cross, color=aqua, linewidth=2)
      if (isNaN(up) || isNaN(dn)) {
        s.obMarkerPlot[i] = { time, value: NaN };
        s.osMarkerPlot[i] = { time, value: NaN };
      } else {
        let upVal = NaN;
        if (up > ob && up > dn) {
          upVal = up + 20;
        } else if (up > ob && up < dn) {
          upVal = dn + 20;
        }
        s.obMarkerPlot[i] = { time, value: upVal };
        let dnVal = NaN;
        if (dn < os && up > dn) {
          dnVal = dn - 20;
        } else if (dn < os && up < dn) {
          dnVal = up - 20;
        }
        s.osMarkerPlot[i] = { time, value: dnVal };
      }
    },
    result(s) {
      // Pine: hline(x1), hline(x2) where x1=OBOS?ob:false, x2=OBOS?os:false
      const hlines: any[] = [];
      if (showOBOS) {
        hlines.push({ value: ob, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } });
        hlines.push({ value: os, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } });
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'resistance': s.resistancePlot.slice(),
          'support': s.supportPlot.slice(),
          'obMarker': s.obMarkerPlot.slice(),
          'osMarker': s.osMarkerPlot.slice(),
        },
        hlines,
        plotCandles: { candle0: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MatrixSeriesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MatrixSeriesInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotCandles: { candle0: PlotCandleData[] } } {
  return fullResult(createRun(inputs).update(bars));
}

export const MatrixSeries = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
