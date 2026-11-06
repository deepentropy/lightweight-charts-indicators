/**
 * EMA Oscillator [Alpha Extract]
 *
 * Z-score of the distance of the close to its EMA: z = (close - ema(close, period)) / stdev(close - ema, period).
 * Threshold lines at +-mild / +-moderate / +-extreme: fixed sigma levels, or (default) percentages of the highest
 * |z| over the lookback. The z-score is a histogram coloured by its zone, with a background in the zone colour, and
 * circles on the price chart when z crosses above the extreme level (sell) or below minus the extreme level (buy).
 * Alerts (alertcondition, `alerts` of the result): z crossing above the extreme / moderate level ('Extremely
 * Overbought Alert' / 'Overbought Alert') and below minus the extreme / moderate level ('Extremely Oversold Alert' /
 * 'Oversold Alert').
 *
 * Reference: "EMA Oscillator [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAOscillatorInputs {
  /** EMA period (also the stdev length) */
  emaPeriod: number;
  /** Limit factor (not used by the script) */
  limitFactor: number;
  mildThreshold: number;
  moderateThreshold: number;
  extremeThreshold: number;
  /** Use the percentage thresholds (of the highest |z| over the lookback) */
  usePercentage: boolean;
  mildPct: number;
  moderatePct: number;
  extremePct: number;
  lookbackPeriod: number;
  showBackground: boolean;
  showThresholdLines: boolean;
  bgcolorTransparency: number;
  showSignals: boolean;
}

export const defaultInputs: EMAOscillatorInputs = {
  emaPeriod: 50,
  limitFactor: 2.0,
  mildThreshold: 1.0,
  moderateThreshold: 2.0,
  extremeThreshold: 3.0,
  usePercentage: true,
  mildPct: 25.0,
  moderatePct: 50.0,
  extremePct: 95.0,
  lookbackPeriod: 43,
  showBackground: true,
  showThresholdLines: true,
  bgcolorTransparency: 92,
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaPeriod', type: 'int', title: 'EMA Period', defval: 50, min: 2, max: 50 },
  { id: 'limitFactor', type: 'float', title: 'Limit Factor', defval: 2.0, min: 0.5, max: 5.0, step: 0.1 },
  { id: 'mildThreshold', type: 'float', title: 'Mild Threshold (±1σ)', defval: 1.0, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'moderateThreshold', type: 'float', title: 'Moderate Threshold (±2σ)', defval: 2.0, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'extremeThreshold', type: 'float', title: 'Extreme Threshold (±3σ)', defval: 3.0, min: 0.1, max: 5.0, step: 0.1 },
  { id: 'usePercentage', type: 'bool', title: 'Use Percentage Thresholds', defval: true },
  { id: 'mildPct', type: 'float', title: 'Mild Threshold (%)', defval: 25.0, min: 5.0, max: 100.0, step: 5.0 },
  { id: 'moderatePct', type: 'float', title: 'Moderate Threshold (%)', defval: 50.0, min: 5.0, max: 100.0, step: 5.0 },
  { id: 'extremePct', type: 'float', title: 'Extreme Threshold (%)', defval: 95.0, min: 5.0, max: 100.0, step: 5.0 },
  { id: 'lookbackPeriod', type: 'int', title: 'Range Lookback Period', defval: 43, min: 10, max: 200 },
  { id: 'showBackground', type: 'bool', title: 'Show Background Colors', defval: true },
  { id: 'showThresholdLines', type: 'bool', title: 'Show Threshold Lines', defval: true },
  { id: 'bgcolorTransparency', type: 'int', title: 'Background Transparency', defval: 92, min: 0, max: 95, step: 5 },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Extremely Overbought', color: '#ff0303', lineWidth: 2 },
  { id: 'plot1', title: 'Overbought', color: 'rgb(255, 106, 106)', lineWidth: 1 },
  { id: 'plot2', title: 'Mildly Overbought', color: 'rgb(184, 100, 86)', lineWidth: 1 },
  { id: 'plot3', title: 'Mildly Oversold', color: '#01b844', lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: '#00ff66', lineWidth: 1 },
  { id: 'plot5', title: 'Extremely Oversold', color: '#00ff66', lineWidth: 2 },
  { id: 'plot6', title: 'EMA Oscillator Z-Score', color: '#a1a1a1', lineWidth: 2, style: 'histogram' },
];

/** hline(0, "Zero Line", color = #005720, linestyle = hline.style_solid, linewidth = 2) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: '#005720', linestyle: 'solid', linewidth: 2 },
];

export const metadata = {
  title: 'EMA Oscillator [Alpha Extract]',
  shortTitle: 'EMA Oscillator [Alpha Extract]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface EmaOscRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  dev: ReturnType<typeof taStep.stdev>;
  high: ReturnType<typeof taStep.highest>;
  crosses: Array<{ step(a: number, b: number): boolean; commit(): void }>;
  lines: Point[][];
  zData: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EMAOscillatorInputs>): BarStudy<EmaOscRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const t = cfg.bgcolorTransparency;
  const bg = (c: string) => String(color.new(c, t));
  const bgExtremeOb = bg('#ff0303');
  const bgModerateOb = bg('#ff6a6a');
  const bgMildOb = bg('#b86456');
  const bgNeutral = bg('#005720');
  const bgMildOs = bg('#01b844');
  const bgOs = bg('#00ff66');
  const sellColor = String(color.rgb(255, 3, 3, 37));
  const buyColor = String(color.rgb(0, 255, 102, 43));
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  const lineColors = ['#ff0303', 'rgb(255, 106, 106)', 'rgb(184, 100, 86)', '#01b844', '#00ff66', '#00ff66'];
  return {
    init() {
      const ema = taStep.ema(cfg.emaPeriod);
      const dev = taStep.stdev();
      const high = taStep.highest();
      const crosses = [taStep.crossover(), taStep.crossunder(), taStep.crossover(), taStep.crossunder()];
      const s: EmaOscRun = {
        ema, dev, high, crosses, lines: [[], [], [], [], [], []], zData: [], bgColors: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [ema, dev, high, ...crosses], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [...s.lines, s.zData, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // oscillator_values = close - ta.ema(close, ema_period); z_score = oscillator_values / ta.stdev(oscillator_values, ema_period)
      const osc = b.close - s.ema.step(b.close);
      const sd = s.dev.step(osc, cfg.emaPeriod);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the comparisons use the infinite value, the plot shows na
      const z = osc / sd;

      // osc_high = ta.highest(math.abs(z_score), lookback_period)
      const h = s.high.step(Math.abs(z), cfg.lookbackPeriod);
      const mild = cfg.usePercentage ? h * (cfg.mildPct / 100.0) : cfg.mildThreshold;
      const moderate = cfg.usePercentage ? h * (cfg.moderatePct / 100.0) : cfg.moderateThreshold;
      const extreme = cfg.usePercentage ? h * (cfg.extremePct / 100.0) : cfg.extremeThreshold;

      // signal_color: zone colour of the histogram
      let signalColor: string;
      if (ge(z, extreme)) signalColor = '#ff0303';
      else if (ge(z, moderate)) signalColor = '#ff6a6a';
      else if (ge(z, mild)) signalColor = '#b86456';
      else if (gt(z, -mild)) signalColor = '#a1a1a1';
      else if (gt(z, -moderate)) signalColor = '#01b844';
      else if (gt(z, -extreme)) signalColor = '#00ff66';
      else signalColor = '#00ff66';

      // bgcolor: same zones (neutral #005720), color.new(c, bgcolor_transparency); an na z-score takes the last branch
      if (cfg.showBackground) {
        let c: string;
        if (ge(z, extreme)) c = bgExtremeOb;
        else if (ge(z, moderate)) c = bgModerateOb;
        else if (ge(z, mild)) c = bgMildOb;
        else if (gt(z, -mild)) c = bgNeutral;
        else if (gt(z, -moderate)) c = bgMildOs;
        else c = bgOs;
        s.bgColors.push({ time, color: c });
      }

      // plot(..., display = show_threshold_lines ? display.all : display.none): a hidden plot draws nothing
      const show = cfg.showThresholdLines;
      s.lines[0][i] = { time, value: show ? finite(extreme) : NaN, color: lineColors[0] };
      s.lines[1][i] = { time, value: show ? finite(moderate) : NaN, color: lineColors[1] };
      s.lines[2][i] = { time, value: show ? finite(mild) : NaN, color: lineColors[2] };
      s.lines[3][i] = { time, value: show ? finite(-1 * mild) : NaN, color: lineColors[3] };
      s.lines[4][i] = { time, value: show ? finite(-1 * moderate) : NaN, color: lineColors[4] };
      s.lines[5][i] = { time, value: show ? finite(-1 * extreme) : NaN, color: lineColors[5] };
      // plot(z_score, "EMA Oscillator Z-Score", style = plot.style_histogram, color = signal_color, linewidth = 2)
      s.zData[i] = { time, value: finite(z), color: signalColor };

      // sell_signal = show_signals and ta.crossover(z_score, selected_extreme)
      // buy_signal = show_signals and ta.crossunder(z_score, -selected_extreme) (exact comparisons)
      const sell = s.crosses[0].step(z, extreme);
      const buy = s.crosses[1].step(z, -extreme);
      if (cfg.showSignals) {
        // plotshape(sell_signal, "Sell", shape.circle, location.abovebar, size.tiny, force_overlay = true)
        if (sell) s.markers.push({ time, position: 'aboveBar', shape: 'circle', color: sellColor, size: 'tiny', forceOverlay: true });
        // plotshape(buy_signal, "Buy", shape.circle, location.belowbar, size.tiny, force_overlay = true)
        if (buy) s.markers.push({ time, position: 'belowBar', shape: 'circle', color: buyColor, size: 'tiny', forceOverlay: true });
      }
      // alertcondition(ta.crossover(z_score, selected_extreme) / ta.crossunder(z_score, -selected_extreme) /
      // ta.crossover(z_score, selected_moderate) / ta.crossunder(z_score, -selected_moderate)) (show_signals not used)
      const over = s.crosses[2].step(z, moderate);
      const under = s.crosses[3].step(z, -moderate);
      s.flags[0][i] = sell;
      s.flags[1][i] = buy;
      s.flags[2][i] = over;
      s.flags[3][i] = under;
      if (sell) s.times[0].push(time as number);
      if (buy) s.times[1].push(time as number);
      if (over) s.times[2].push(time as number);
      if (under) s.times[3].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0].slice(),
          plot1: s.lines[1].slice(),
          plot2: s.lines[2].slice(),
          plot3: s.lines[3].slice(),
          plot4: s.lines[4].slice(),
          plot5: s.lines[5].slice(),
          plot6: s.zData.slice(),
        },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#005720', linestyle: 'solid', linewidth: 2 } }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Extremely Overbought Alert', message: 'EMA Oscillator reached extremely overbought levels' },
  { id: 'alert1', title: 'Extremely Oversold Alert', message: 'EMA Oscillator reached extremely oversold levels' },
  { id: 'alert2', title: 'Overbought Alert', message: 'EMA Oscillator reached overbought levels' },
  { id: 'alert3', title: 'Oversold Alert', message: 'EMA Oscillator reached oversold levels' },
];

export const EMAOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
