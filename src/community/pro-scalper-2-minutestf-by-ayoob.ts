/**
 * Strict 1-Signal Pro Scalper v2
 *
 * A VWMA of hlc3 and an EMA trend baseline of the close. BUY when the close crosses over the VWMA while the VWMA
 * rises and the last signal was not a BUY; SELL when the close crosses under the VWMA while the VWMA falls and the
 * last signal was not a SELL (signals alternate). The signals are text labels at the bar low (BUY) / high (SELL).
 *
 * Reference: "Pro Scalper - 2 MinutesTF by Ayoob" by FGMNDFBF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ProScalperAyoobInputs {
  /** VWMA length */
  lenVwma: number;
  /** EMA length of the trend baseline */
  lenTrend: number;
}

export const defaultInputs: ProScalperAyoobInputs = {
  lenVwma: 7,
  lenTrend: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenVwma', type: 'int', title: 'VWMA Length', defval: 7 },
  { id: 'lenTrend', type: 'int', title: 'Institutional Trend MA', defval: 200 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA 7', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: '200 Trend Baseline', color: color.gray, lineWidth: 2 },
];

export const metadata = {
  title: 'Strict 1-Signal Pro Scalper v2',
  shortTitle: 'Strict 1-Signal Pro Scalper v2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ProScalperVars {
  /** var int current_state = 0 */
  state: number;
}

interface ProScalperRun extends BarRunState<ProScalperVars> {
  vwma: WindowVwma;
  trend: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  vw: number[];
  vwData: Point[];
  trendData: Point[];
  markers: MarkerData[];
}

const noShape = String(color.new(color.white, 100));

function study(inputs: Partial<ProScalperAyoobInputs>): BarStudy<ProScalperRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const vwma = new WindowVwma(cfg.lenVwma);
      const trend = taStep.ema(cfg.lenTrend);
      const up = taStep.crossover();
      const dn = taStep.crossunder();
      const s: ProScalperRun = {
        vwma, trend, up, dn, vw: [], vwData: [], trendData: [], markers: [],
        steps: [vwma, trend, up, dn], vars: { state: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.vw, s.vwData, s.trendData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vw = s.vwma.step((b.high + b.low + b.close) / 3, b.volume ?? NaN);
      const trendMA = s.trend.step(b.close);
      const crossUp = s.up.step(b.close, vw);
      const crossDn = s.dn.step(b.close, vw);
      s.vw[i] = vw;
      const prev = i > 0 ? s.vw[i - 1] : NaN;
      const rising = gt(vw, prev); // vwma7 > vwma7[1]
      const falling = gt(prev, vw); // vwma7 < vwma7[1]
      let isLong = false;
      let isShort = false;
      const v = s.vars;
      if (crossUp && rising && v.state !== 1) {
        isLong = true;
        v.state = 1;
      }
      if (crossDn && falling && v.state !== -1) {
        isShort = true;
        v.state = -1;
      }
      // plotshape(isLong ? low : na, location.absolute, color.new(color.white, 100), shape.labelup, text = "BUY",
      //   textcolor = color.green, size.small)
      if (isLong) {
        s.markers.push({ time: b.time, position: 'atPriceBottom', price: b.low, shape: 'labelUp',
          color: noShape, text: 'BUY', textColor: color.green, size: 'small' });
      }
      if (isShort) {
        s.markers.push({ time: b.time, position: 'atPriceTop', price: b.high, shape: 'labelDown',
          color: noShape, text: 'SELL', textColor: color.red, size: 'small' });
      }
      s.vwData[i] = { time: b.time, value: vw, color: color.blue };
      s.trendData[i] = { time: b.time, value: trendMA, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.vwData.slice(), plot1: s.trendData.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ProScalperAyoobInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ProScalperAyoobInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ProScalperAyoob = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
