/**
 * Aegis Prime Flow
 *
 * WaveTrend oscillator: esa = ema(src, len), d = ema(|src - esa|, len), ci = (src - esa) / (0.015 * d),
 * tci = ema(ci, smooth). The signal is sma(tci, 4); a money-flow cloud (sma(tci, 10) filled to zero, teal above
 * zero, red below) is drawn behind. Power bars at +90 / -90 show the tci sign and strength (beyond +-60). Labels
 * mark the crosses into the overbought (60) / oversold (-60) zones and triangles mark the crosses of tci with the
 * signal below -50 (bullish) or above 50 (bearish).
 *
 * Alerts (alertcondition, `alerts` of the result): bullish / bearish reversal (the triangles) and the oversold /
 * overbought entrances (the OS / OB labels).
 *
 * Reference: "Aegis Prime Flow [wjdtks255]" by wjdtks255
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © wjdtks255
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AegisPrimeFlowInputs {
  /** Oscillator calculation period */
  len: number;
  /** Signal smoothness length */
  smooth: number;
  /** Source data price */
  src: SourceType;
}

export const defaultInputs: AegisPrimeFlowInputs = {
  len: 14,
  smooth: 3,
  src: 'hlc3',
};

const G_LOGIC = 'Core Technical Logic Settings (핵심 연산 알고리즘 설정)';

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Oscillator Calculation Period (오실레이터 연산 주기)', defval: 14, min: 1, group: G_LOGIC },
  { id: 'smooth', type: 'int', title: 'Signal Smoothness Length (시그널 평활화 주기)', defval: 3, min: 1, group: G_LOGIC },
  { id: 'src', type: 'source', title: 'Source Data Price (기준 데이터 소스)', defval: 'hlc3', group: G_LOGIC },
];

const TEAL = '#00ffbb';
const RED = '#ff3a2d';
const BG_TEAL = String(color.new(TEAL, 80));
const BG_RED = String(color.new(RED, 80));
const TEAL_50 = String(color.new(TEAL, 50));
const RED_50 = String(color.new(RED, 50));
const GRAY_80 = String(color.new(color.gray, 80));
const GUIDE = String(color.new(color.white, 80));
const ZERO_LINE = String(color.new(color.white, 90));

export const plotConfig: PlotConfig[] = [
  // plot(mf, color = na) / plot(0, color = na): fill anchors, not drawn
  { id: 'plot0', title: 'Money Flow Line', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'Zero Base Plot', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Power Bar Track', color: TEAL, lineWidth: 4, style: 'linebr' },
  { id: 'plot3', title: 'Lower Power Bar Track', color: RED, lineWidth: 4, style: 'linebr' },
  { id: 'plot4', title: 'Main Flow Oscillator', color: TEAL, lineWidth: 2 },
];

/** hline(60 / -60, dashed) and hline(0) (Pine default line style: dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 60, title: 'Overbought Boundary', color: GUIDE, linestyle: 'dashed' },
  { id: 'hline_os', price: -60, title: 'Oversold Boundary', color: GUIDE, linestyle: 'dashed' },
  { id: 'hline_zero', price: 0, title: 'Quantum Zero Line', color: ZERO_LINE, linestyle: 'dashed' },
];

/** fill(p_mf, p_z, mf > 0 ? color_bg_teal : color_bg_red): per-bar colours in the result */
export const fillConfig: FillConfig[] = [
  { id: 'fill_mf', plot1: 'plot0', plot2: 'plot1', color: BG_TEAL, title: 'Money Flow Cloud Layer' },
];

export const metadata = {
  title: 'Aegis Prime Flow [wjdtks255]',
  shortTitle: 'Aegis_Flow+',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Cross = ReturnType<typeof taStep.crossover>;

interface AegisRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  dEma: ReturnType<typeof taStep.ema>;
  tciEma: ReturnType<typeof taStep.ema>;
  wt2Sma: WindowSma;
  mfSma: WindowSma;
  /** is_os, is_ob, crossover(tci, wt2), crossunder(tci, wt2) */
  crosses: Cross[];
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AegisPrimeFlowInputs>): BarStudy<AegisRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AegisRun = {
        esa: taStep.ema(cfg.len), dEma: taStep.ema(cfg.len), tciEma: taStep.ema(cfg.smooth),
        wt2Sma: new WindowSma(4), mfSma: new WindowSma(10),
        crosses: [taStep.crossunder(), taStep.crossover(), taStep.crossover(), taStep.crossunder()],
        plots: [[], [], [], [], []], fillColors: [], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.esa, s.dEma, s.tciEma, s.wt2Sma, s.mfSma, ...s.crosses];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const ap = value(bars[i]);
      const esa = s.esa.step(ap);
      const d = s.dEma.step(Math.abs(ap - esa));
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema skips the infinite value as na
      const ci = (ap - esa) / (0.015 * d);
      const v = s.tciEma.step(ci);
      const wt2 = s.wt2Sma.step(v);
      const mf = s.mfSma.step(v);

      // ta.crossover / ta.crossunder: exact comparisons with the last bar where both values were not na
      const isOs = s.crosses[0].step(v, -60);
      const isOb = s.crosses[1].step(v, 60);
      const crossUp = s.crosses[2].step(v, wt2);
      const crossDown = s.crosses[3].step(v, wt2);

      const p = s.plots;
      p[0][i] = { time: t, value: Number.isFinite(mf) ? mf : NaN, color: 'transparent' };
      p[1][i] = { time: t, value: 0, color: 'transparent' };
      // fill(p_mf, p_z, color = mf > 0 ? color_bg_teal : color_bg_red)
      s.fillColors[i] = gt(mf, 0) ? BG_TEAL : BG_RED;
      // bar_color_top = tci > 0 ? (tci > 60 ? color_teal : color.new(color_teal, 50)) : color.new(color.gray, 80)
      const top = gt(v, 0) ? (gt(v, 60) ? TEAL : TEAL_50) : GRAY_80;
      const bot = lt(v, 0) ? (lt(v, -60) ? RED : RED_50) : GRAY_80;
      p[2][i] = { time: t, value: 90, color: top };
      p[3][i] = { time: t, value: -90, color: bot };
      // osc_color = tci > wt2 ? color_teal : color_red
      p[4][i] = { time: t, value: Number.isFinite(v) ? v : NaN, color: gt(v, wt2) ? TEAL : RED };

      // plotshape(is_os, "OS", shape.labelup, location.bottom, color.orange, textcolor = color.black, size.tiny)
      if (isOs) {
        s.markers.push({ time: t, position: 'bottom', shape: 'labelUp', color: color.orange, text: 'OS',
          textColor: color.black, size: 'tiny' });
      }
      if (isOb) {
        s.markers.push({ time: t, position: 'top', shape: 'labelDown', color: color.orange, text: 'OB',
          textColor: color.black, size: 'tiny' });
      }
      // buy_sig = ta.crossover(tci, wt2) and tci < -50; sell_sig = ta.crossunder(tci, wt2) and tci > 50
      const buy = crossUp && lt(v, -50);
      const sell = crossDown && gt(v, 50);
      if (buy) {
        s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: TEAL, size: 'small' });
      }
      if (sell) {
        s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: RED, size: 'small' });
      }
      // alertcondition(buy_sig) / (sell_sig) / (is_os) / (is_ob)
      const flags = [buy, sell, isOs, isOb];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: [
          { value: 60, options: { title: 'Overbought Boundary', color: GUIDE, linestyle: 'dashed' } },
          { value: -60, options: { title: 'Oversold Boundary', color: GUIDE, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Quantum Zero Line', color: ZERO_LINE, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Money Flow Cloud Layer' }, colors: s.fillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AegisPrimeFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AegisPrimeFlowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Reversal (강력 매수 반전)', message: '[Prime Flow] Bullish Reversal Signal Triggered! Capital Inflow Starting. Price: {{close}}' },
  { id: 'alert1', title: 'Bearish Reversal (강력 매도 반전)', message: '[Prime Flow] Bearish Reversal Signal Triggered! Capital Outflow Starting. Price: {{close}}' },
  { id: 'alert2', title: 'Oversold Entrance (과매도 진입)', message: '[Prime Flow] Market Entered Oversold Zone. Watch for Reversal. Price: {{close}}' },
  { id: 'alert3', title: 'Overbought Entrance (과매수 진입)', message: '[Prime Flow] Market Entered Overbought Zone. Watch for Correction. Price: {{close}}' },
];

export const AegisPrimeFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
