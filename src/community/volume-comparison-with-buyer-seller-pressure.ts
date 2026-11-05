/**
 * Volume Comparison with Buyer/Seller Pressure
 *
 * Buyer pressure = (close - open) / (high - low), seller pressure = (open - close) / (high - low). The background is
 * green when the buyer pressure is at least 0.75, red when the seller pressure is at least 0.75, else gray. The SMAs
 * of the volume over 3, 5, 10 and 20 bars and the volume are drawn as columns. When the volume is above one of the
 * SMAs, a colour layer is added to the background and a shape is drawn at the top of the pane (circle, label, arrow,
 * flag for the 3, 5, 10, 20-bar SMA).
 * Alerts (alertcondition, `alerts` of the result): 'Strong Buy Signal' / 'Strong Sell Signal' when the buyer / seller
 * pressure is at least 0.75, 'Neutral Market' on the other bars.
 *
 * Reference: "Volume Comparison with Buyer/Seller Pressure" by ask2maniish
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeComparisonWithBuyerSellerPressureInputs {
  smaLength3: number;
  smaLength5: number;
  smaLength10: number;
  smaLength20: number;
  /** Pressure threshold (shown in the settings; the Pine signals use the constant 0.75) */
  pressureThreshold: number;
  show3DayAvg: boolean;
  show5DayAvg: boolean;
  show10DayAvg: boolean;
  show20DayAvg: boolean;
  showDailyVolume: boolean;
}

export const defaultInputs: VolumeComparisonWithBuyerSellerPressureInputs = {
  smaLength3: 3,
  smaLength5: 5,
  smaLength10: 10,
  smaLength20: 20,
  pressureThreshold: 0.75,
  show3DayAvg: true,
  show5DayAvg: true,
  show10DayAvg: true,
  show20DayAvg: true,
  showDailyVolume: true,
};

const PRESSURE_TOOLTIP = 'Buyer Pressure (Strong Buying) :ideal Range: Typically 0.75 to 1.0 (or higher) & Seller '
  + 'Pressure (Strong Selling) :ideal Range: Typically 0.75 to 1.0 (or higher) & Neutral or Indecision Zone Ideal '
  + 'Range: Typically 0.25 to 0.75 for both buyer and seller pressure.';

export const inputConfig: InputConfig[] = [
  { id: 'smaLength3', type: 'int', title: '3-Day SMA Length', defval: 3, min: 3, max: 3 },
  { id: 'smaLength5', type: 'int', title: '5-Day SMA Length', defval: 5, min: 5, max: 5 },
  { id: 'smaLength10', type: 'int', title: '10-Day SMA Length', defval: 10, min: 10, max: 10 },
  { id: 'smaLength20', type: 'int', title: '10-Day SMA Length', defval: 20, min: 20, max: 20 },
  { id: 'pressureThreshold', type: 'float', title: 'Pressure Threshold', defval: 0.75, min: 0, step: 0.01, tooltip: PRESSURE_TOOLTIP },
  { id: 'show3DayAvg', type: 'bool', title: 'Show 3-Day Average Volume', defval: true },
  { id: 'show5DayAvg', type: 'bool', title: 'Show 5-Day Average Volume', defval: true },
  { id: 'show10DayAvg', type: 'bool', title: 'Show 10-Day Average Volume', defval: true },
  { id: 'show20DayAvg', type: 'bool', title: 'Show 20-Day Average', defval: true },
  { id: 'showDailyVolume', type: 'bool', title: 'Show Daily Volume', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buyer Pressure', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Seller Pressure', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: '3-Day Avg Volume', color: '#2962ff', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: '5-Day Avg Volume', color: '#673ab7', lineWidth: 1, style: 'columns' },
  { id: 'plot4', title: '10-Day Avg Volume', color: '#ff9800', lineWidth: 1, style: 'columns' },
  { id: 'plot5', title: '20-Day Avg Volume', color: '#00bcd4', lineWidth: 1, style: 'columns' },
  { id: 'plot6', title: 'Daily Volume', color: '#d6ad6e', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Volume Comparison with Buyer/Seller Pressure',
  shortTitle: 'Volume Comparison with Buyer/Seller Pressure',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface VolumeComparisonRun extends BarRunState<Record<string, never>> {
  smas: ReturnType<typeof taStep.sma>[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeComparisonWithBuyerSellerPressureInputs>): BarStudy<VolumeComparisonRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.smaLength3, cfg.smaLength5, cfg.smaLength10, cfg.smaLength20];

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const buyBg = String(color.new(color.green, 85));
  const sellBg = String(color.new(color.red, 85));
  const neutralBg = String(color.new(color.gray, 95));
  // color.rgb(r, g, b, 80)
  const hl3 = String(color.rgb(41, 98, 255, 80));
  const hl5 = String(color.rgb(103, 58, 183, 80));
  const hl10 = String(color.rgb(255, 152, 0, 80));
  const hl20 = String(color.rgb(0, 188, 212, 80));

  return {
    init() {
      const s: VolumeComparisonRun = {
        smas: lengths.map(() => taStep.sma()),
        plots: Array.from({ length: 7 }, () => []),
        markers: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.smas;
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = b.volume ?? NaN;
      const [avg3, avg5, avg10, avg20] = s.smas.map((m, k) => m.step(v, lengths[k]));
      // plain divisions: x / 0 is +-infinity (the >= comparisons use it, the plots show na), 0 / 0 na
      const buyerPressure = (b.close - b.open) / (b.high - b.low);
      const sellerPressure = (b.open - b.close) / (b.high - b.low);
      const strongBuy = ge(buyerPressure, 0.75);
      const strongSell = ge(sellerPressure, 0.75);
      // alertcondition(strong_buy_signal) / alertcondition(strong_sell_signal) / alertcondition(neutral_signal)
      [strongBuy, strongSell, !strongBuy && !strongSell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t as number);
      });

      // bgcolor layers in the Pine order (a later layer is drawn on top)
      const bgColors = s.bgColors;
      bgColors.push({ time: t, color: strongBuy ? buyBg : strongSell ? sellBg : neutralBg });
      const above3 = gt(v, avg3);
      const above5 = gt(v, avg5);
      const above10 = gt(v, avg10);
      const above20 = gt(v, avg20);
      if (above3) bgColors.push({ time: t, color: hl3 });
      if (above5) bgColors.push({ time: t, color: hl5 });
      if (above10) bgColors.push({ time: t, color: hl10 });
      if (above20) bgColors.push({ time: t, color: hl20 });

      const p = s.plots;
      p[0][i] = { time: t, value: fin(buyerPressure), color: color.green };
      p[1][i] = { time: t, value: fin(sellerPressure), color: color.red };
      p[2][i] = { time: t, value: cfg.show3DayAvg ? fin(avg3) : NaN, color: '#2962ff' };
      p[3][i] = { time: t, value: cfg.show5DayAvg ? fin(avg5) : NaN, color: '#673ab7' };
      p[4][i] = { time: t, value: cfg.show10DayAvg ? fin(avg10) : NaN, color: '#ff9800' };
      p[5][i] = { time: t, value: cfg.show20DayAvg ? fin(avg20) : NaN, color: '#00bcd4' };
      p[6][i] = { time: t, value: cfg.showDailyVolume ? fin(v) : NaN, color: '#d6ad6e' };

      // plotshape(..., location = location.top)
      const markers = s.markers;
      if (above3) markers.push({ time: t, position: 'top', shape: 'circle', color: '#2962ff', size: 'small' });
      if (above5) markers.push({ time: t, position: 'top', shape: 'labelUp', color: '#673ab7', size: 'small' });
      if (above10) markers.push({ time: t, position: 'top', shape: 'arrowUp', color: '#ff9800', size: 'small' });
      if (above20) markers.push({ time: t, position: 'top', shape: 'flag', color: '#00bcd4', size: 'tiny' });
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeComparisonWithBuyerSellerPressureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeComparisonWithBuyerSellerPressureInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Strong Buy Signal', message: 'A strong buy signal has been detected (Buyer Pressure >= 0.75).' },
  { id: 'alert1', title: 'Strong Sell Signal', message: 'A strong sell signal has been detected (Seller Pressure >= 0.75).' },
  { id: 'alert2', title: 'Neutral Market', message: 'Market is neutral, with no strong buyer or seller dominance.' },
];

export const VolumeComparisonWithBuyerSellerPressure = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
