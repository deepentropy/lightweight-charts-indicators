/**
 * RedK Trader Pressure Index (TPX v5.0)
 *
 * Measures bull/bear pressure from high/low changes relative to
 * a 2-bar range baseline. Bull pressure = how far bulls pull
 * highs and lows up; bear pressure = how far bears push them down.
 * Net pressure (TPX) is the WMA-smoothed difference.
 * v3.0 adds optional pre-smoothing; v4.0 adds dominant pressure signals;
 * v5.0 adds TPX swing alerts.
 * Alerts (alertcondition, `alerts` of the result): 'TPX Bulls in Control' (bull pressure >= control level), 'TPX
 * Bears in Control' (bear pressure >= control level) and 'Net Pressure Swing' (TPX crosses 0).
 * No swing markers: the original draws the swing only as the colour change of the Net Pressure line.
 *
 * Reference: "RedK Trader Pressure Index (TPX)" by RedKTrader
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RedKTPXInputs {
  length: number;
  smooth: number;
  controlLevel: number;
  preSmooth: boolean;
  preSmoothLen: number;
  slevelOn: boolean;
  slevel: number;
}

export const defaultInputs: RedKTPXInputs = {
  length: 7,
  smooth: 3,
  controlLevel: 30,
  preSmooth: false,
  preSmoothLen: 3,
  slevelOn: false,
  slevel: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Avg Length', defval: 7, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 3, min: 1 },
  { id: 'controlLevel', type: 'int', title: 'Control Level', defval: 30, min: 5, max: 100 },
  { id: 'preSmooth', type: 'bool', title: 'Pre-smoothing?', defval: false },
  { id: 'preSmoothLen', type: 'int', title: 'Pre-smooth Length', defval: 3, min: 1 },
  { id: 'slevelOn', type: 'bool', title: 'Pressure Signal Line', defval: false },
  { id: 'slevel', type: 'int', title: 'Signal Level', defval: 70, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Pressure', color: '#33ff0099', lineWidth: 3, style: 'area' },
  { id: 'plot1', title: 'Bear Pressure', color: '#ff111166', lineWidth: 3, style: 'area' },
  { id: 'plot2', title: 'Net Pressure', color: '#ffffff', lineWidth: 3 },
  { id: 'plot3', title: 'Cold', color: '#800000', lineWidth: 3, style: 'circles' },
  { id: 'plot4', title: 'Hot', color: '#008000', lineWidth: 3, style: 'cross' },
];

export const metadata = {
  title: 'RedK Trader Pressure Index',
  shortTitle: 'RedK TPX',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };
type Wma = ReturnType<typeof taStep.wma>;

interface TpxRun extends BarRunState<Record<string, never>> {
  highest2: WindowExtreme;
  lowest2: WindowExtreme;
  hiChange: ReturnType<typeof taStep.change>;
  loChange: ReturnType<typeof taStep.change>;
  bullWma: Wma;
  bearWma: Wma;
  bullPre: Wma | null;
  bearPre: Wma | null;
  tpxWma: Wma;
  tpxAlert: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RedKTPXInputs>): BarStudy<TpxRun, Result> {
  const { length, smooth, controlLevel, preSmooth, preSmoothLen, slevelOn, slevel } = { ...defaultInputs, ...inputs };
  const warmup = length + smooth;
  // TPX of the original is na until its averages are known: the port's zeros before that are not crossed
  const tpxFirst = (length - 1) + (preSmooth ? preSmoothLen - 1 : 0) + (smooth - 1);
  return {
    init() {
      // 2-bar range: R = highest(2) - lowest(2)
      const highest2 = new WindowExtreme(false, 2);
      const lowest2 = new WindowExtreme(true, 2);
      // Change in high and low (1-bar)
      const hiChange = taStep.change(1);
      const loChange = taStep.change(1);
      const bullWma = taStep.wma();
      const bearWma = taStep.wma();
      const bullPre = preSmooth ? taStep.wma() : null;
      const bearPre = preSmooth ? taStep.wma() : null;
      const tpxWma = taStep.wma();
      const s: TpxRun = {
        highest2, lowest2, hiChange, loChange, bullWma, bearWma, bullPre, bearPre, tpxWma, tpxAlert: [],
        plots: [[], [], [], [], []], flags: [[], [], []], times: [[], [], []],
        steps: [highest2, lowest2, hiChange, loChange, bullWma, bearWma, ...(bullPre && bearPre ? [bullPre, bearPre] : []), tpxWma],
        vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.tpxAlert, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const h2 = s.highest2.step(b.high);
      const l2 = s.lowest2.step(b.low);
      const R = (h2 != null && l2 != null && !isNaN(h2) && !isNaN(l2)) ? h2 - l2 : 0;
      const hiChg = s.hiChange.step(b.high);
      const loChg = s.loChange.step(b.low);

      // Calculate raw bull and bear pressure bar-by-bar
      let bulls = 0;
      let bears = 0;
      if (!(R === 0 || i === 0)) {
        // Bull pressure: how far bulls pull high and low up
        const hiup = Math.max(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
        const loup = Math.max(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
        bulls = Math.min((hiup + loup) / R, 1) * 100;

        // Bear pressure: how far bears push high and low down (converted to positive)
        const hidn = Math.min(hiChg != null && !isNaN(hiChg) ? hiChg : 0, 0);
        const lodn = Math.min(loChg != null && !isNaN(loChg) ? loChg : 0, 0);
        bears = Math.max((hidn + lodn) / R, -1) * -100;
      }

      // WMA of bull and bear pressure
      const avgBullRaw = s.bullWma.step(bulls, length);
      const avgBearRaw = s.bearWma.step(bears, length);
      // Pine v3.0: optional pre-smoothing (avgbulls = pre_s ? wma(avgbull, pre_sv) : avgbull)
      const avgBulls = s.bullPre ? s.bullPre.step(avgBullRaw, preSmoothLen) : avgBullRaw;
      const avgBears = s.bearPre ? s.bearPre.step(avgBearRaw, preSmoothLen) : avgBearRaw;

      // Net = avgBulls - avgBears, then WMA smooth
      const abVal = (avgBulls != null && !isNaN(avgBulls)) ? avgBulls : 0;
      const abearVal = (avgBears != null && !isNaN(avgBears)) ? avgBears : 0;
      const tpx = s.tpxWma.step(abVal - abearVal, smooth);

      const time = b.time;
      s.plots[0][i] = { time, value: (i < warmup || avgBulls == null || isNaN(avgBulls)) ? NaN : avgBulls };
      s.plots[1][i] = { time, value: (i < warmup || avgBears == null || isNaN(avgBears)) ? NaN : avgBears };
      // Pine: TPX colored by direction: TPX > 0 ? white : gray
      s.plots[2][i] = {
        time,
        value: (i < warmup || tpx == null || isNaN(tpx)) ? NaN : tpx,
        color: (tpx != null && !isNaN(tpx) && tpx > 0) ? '#ffffff' : '#808080',
      };
      // maxbulls = avgbulls >= clevel; maxbears = avgbears >= clevel
      const maxBulls = avgBulls != null && !isNaN(avgBulls) && avgBulls >= controlLevel;
      const maxBears = avgBears != null && !isNaN(avgBears) && avgBears >= controlLevel;
      // Pine: plot(maxbears and slevel_on ? slevel : na, 'Cold', style=circles, color=maroon, linewidth=3)
      // Pine: plot(maxbulls and slevel_on ? slevel : na, 'Hot', style=cross, color=green, linewidth=3)
      const off = !slevelOn || i < warmup;
      s.plots[3][i] = { time, value: off ? NaN : maxBears ? slevel : NaN };
      s.plots[4][i] = { time, value: off ? NaN : maxBulls ? slevel : NaN };

      // TPXswing = ta.cross(TPX, 0)
      const tpxAlert = i < tpxFirst ? NaN : tpx ?? NaN;
      s.tpxAlert[i] = tpxAlert;
      const prev = i > 0 ? s.tpxAlert[i - 1] : NaN;
      const tpxUp = tpxAlert > 0 && prev <= 0;
      const tpxDn = tpxAlert < 0 && prev >= 0;
      const flags = [maxBulls, maxBears, tpxUp || tpxDn];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plots[0].slice(), 'plot1': s.plots[1].slice(), 'plot2': s.plots[2].slice(),
          'plot3': s.plots[3].slice(), 'plot4': s.plots[4].slice(),
        },
        hlines: [
          { value: 0, options: { color: '#ffee00', linestyle: 'solid' as const, title: 'Zero' } },
          { value: controlLevel, options: { color: '#ffee00', linestyle: 'dotted' as const, title: 'Control Level' } },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RedKTPXInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RedKTPXInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'TPX Bulls in Control', message: 'TPX Bull Pressure >= Control Level' },
  { id: 'alert1', title: 'TPX Bears in Control', message: 'TPX Bear Pressure >= Control Level' },
  { id: 'alert2', title: 'Net Pressure Swing', message: 'Net Pressure Swing Detected!' },
];

export const RedKTPX = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
