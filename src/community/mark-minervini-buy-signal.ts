/**
 * Mark Minervini Buy Signal
 *
 * Mark Minervini trend template on the close: SMAs 10 / 20 / 50 / 150 / 200. A buy signal needs the close above
 * the 50, 150 and 200 SMAs, the 150 SMA above the 200 SMA, the 200 SMA above its value 20 bars ago, the 50 SMA
 * above the 150 and 200 SMAs, the close at least 25 % above the 252-bar low and between 75 % and 95 % of the
 * 252-bar high, a percent rank (100 bars) of the 100-bar price change of at least 70, and the volume above its
 * 50-bar SMA. A signal bar gets a large triangle below the bar and a green background.
 *
 * Reference: "Mark Minervini Buy Signal" by Dr_Leong_Yee_Rock
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface MarkMinerviniBuySignalInputs {}

export const defaultInputs: MarkMinerviniBuySignalInputs = {};

export const inputConfig: InputConfig[] = [];

const MA10_COL = 'rgb(233, 243, 33)';
const MA20_COL = 'rgb(33, 229, 243)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '10-day MA', color: MA10_COL, lineWidth: 1 },
  { id: 'plot1', title: '20-day MA', color: MA20_COL, lineWidth: 1 },
  { id: 'plot2', title: '50-day MA', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: '150-day MA', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: '200-day MA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Mark Minervini Buy Signal',
  shortTitle: 'Mark Minervini Buy Signal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };
type Sma = WindowSma;

interface MmRun extends BarRunState<Record<string, never>> {
  ma10: Sma;
  ma20: Sma;
  ma50: Sma;
  ma150: Sma;
  ma200: Sma;
  high52: WindowExtreme;
  low52: WindowExtreme;
  rank: ReturnType<typeof taStep.percentrank>;
  volSma: Sma;
  close: number[];
  ma200Arr: number[];
  p0: Point[];
  p1: Point[];
  p2: Point[];
  p3: Point[];
  p4: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

const BG = String(color.new(color.green, 90));

function study(_inputs: Partial<MarkMinerviniBuySignalInputs>): BarStudy<MmRun, Result> {
  return {
    init() {
      const s: MmRun = {
        ma10: new WindowSma(10), ma20: new WindowSma(20), ma50: new WindowSma(50), ma150: new WindowSma(150),
        ma200: new WindowSma(200),
        high52: new WindowExtreme(false, 252), low52: new WindowExtreme(true, 252), rank: taStep.percentrank(100), volSma: new WindowSma(50),
        close: [], ma200Arr: [], p0: [], p1: [], p2: [], p3: [], p4: [], markers: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma10, s.ma20, s.ma50, s.ma150, s.ma200, s.high52, s.low52, s.rank, s.volSma];
      s.lists = [s.markers, s.bgColors];
      s.series = [s.close, s.ma200Arr, s.p0, s.p1, s.p2, s.p3, s.p4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      s.close[i] = c;
      const ma10 = s.ma10.step(c);
      const ma20 = s.ma20.step(c);
      const ma50 = s.ma50.step(c);
      const ma150 = s.ma150.step(c);
      const ma200 = s.ma200.step(c);
      s.ma200Arr[i] = ma200;
      const high52 = s.high52.step(b.high);
      const low52 = s.low52.step(b.low);
      // priceChange = (close - close[100]) / close[100] * 100 (a plain division)
      const priceChange = i >= 100 ? ((c - s.close[i - 100]) / s.close[i - 100]) * 100 : NaN;
      const rsRanking = s.rank.step(priceChange);
      const volume = b.volume ?? NaN;
      const volSma = s.volSma.step(volume);

      const ma150AboveMa200 = gt(ma150, ma200);
      const ma200TrendingUp = gt(ma200, i >= 20 ? s.ma200Arr[i - 20] : NaN);
      const ma50AboveLongMAs = gt(ma50, ma150) && gt(ma50, ma200);
      const priceAboveMa50 = gt(c, ma50);
      const priceAboveLongMAs = gt(c, ma150) && gt(c, ma200);
      const price25PercentAboveLow = ge(c, low52 * 1.25);
      const priceWithin25PercentOfHigh = ge(c, high52 * 0.75) && le(c, high52 * 0.95);
      const rsRankingPass = ge(rsRanking, 70);
      const volumeIncreasing = gt(volume, volSma);
      const minerviniCriteria = priceAboveLongMAs && ma150AboveMa200 && ma200TrendingUp && ma50AboveLongMAs
        && priceAboveMa50 && price25PercentAboveLow && priceWithin25PercentOfHigh && rsRankingPass && volumeIncreasing;
      if (minerviniCriteria) {
        // plotshape(minerviniCriteria, "Minervini Buy", shape.triangleup, location.belowbar, color.green, size.large)
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'large' });
        // bgcolor(minerviniCriteria ? color.new(color.green, 90) : na)
        s.bgColors.push({ time: b.time, color: BG });
      }
      const t = b.time;
      s.p0[i] = { time: t, value: ma10, color: MA10_COL };
      s.p1[i] = { time: t, value: ma20, color: MA20_COL };
      s.p2[i] = { time: t, value: ma50, color: color.blue };
      s.p3[i] = { time: t, value: ma150, color: color.green };
      s.p4[i] = { time: t, value: ma200, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.p0.slice(), plot1: s.p1.slice(), plot2: s.p2.slice(), plot3: s.p3.slice(), plot4: s.p4.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarkMinerviniBuySignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarkMinerviniBuySignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MarkMinerviniBuySignal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
