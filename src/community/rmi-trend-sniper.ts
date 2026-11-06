/**
 * RMI Trend Sniper
 *
 * Combines RSI (using change(close,1)) with MFI, averaged into rsi_mfi.
 * Trend flips bullish when rsi_mfi crosses above pmom with rising EMA(5),
 * bearish when rsi_mfi drops below nmom with falling EMA(5).
 * Overlay: Range-weighted MA band with ATR-derived width, colored candles, and buy/sell labels.
 * Alerts (alertcondition, `alerts` of the result): 'BUY' (the trend turns positive) and 'SELL' (it turns negative).
 *
 * Reference: "RMI Trend Sniper" by TZack88
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData, LabelData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RMITrendSniperInputs {
  rmiLen: number;
  pmom: number;
  nmom: number;
  fillShow: boolean;
}

export const defaultInputs: RMITrendSniperInputs = {
  rmiLen: 14,
  pmom: 66,
  nmom: 30,
  fillShow: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rmiLen', type: 'int', title: 'RMI Length', defval: 14, min: 1 },
  { id: 'pmom', type: 'int', title: 'Positive above', defval: 66, min: 1, max: 100 },
  { id: 'nmom', type: 'int', title: 'Negative below', defval: 30, min: 1, max: 100 },
  { id: 'fillShow', type: 'bool', title: 'Show Range MA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RRTH', color: '#00bcd4', lineWidth: 1 },
  { id: 'plot1', title: 'RRTH2', color: '#00bcd4', lineWidth: 2 },
  { id: 'plot2', title: 'RRTH3', color: '#00bcd4', lineWidth: 3 },
  { id: 'plot3', title: 'RRTH4', color: '#00bcd4', lineWidth: 4 },
  { id: 'plot4', title: 'Max Band', color: 'transparent', lineWidth: 0 },
  { id: 'plot5', title: 'Min Band', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'RMI Trend Sniper',
  shortTitle: 'RMI Sniper',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface RmiVars {
  positive: boolean;
  negative: boolean;
}

interface RmiRun extends BarRunState<RmiVars> {
  rmaUp: ReturnType<typeof taStep.rma>;
  rmaDown: ReturnType<typeof taStep.rma>;
  mfi: ReturnType<typeof taStep.mfi>;
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  rsiMfi: number[];
  ema5: number[];
  posArr: boolean[];
  negArr: boolean[];
  bandRaw: number[];
  barRange: number[];
  weightArr: number[];
  cwArr: number[];
  plots: Point[][];
  maxArr: number[];
  rwmaValArr: number[];
  minArr: number[];
  colour75: string[];
  barColors: BarColorData[];
  candles: PlotCandleData[];
  labels: LabelData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RMITrendSniperInputs>): BarStudy<RmiRun, Result> {
  const { rmiLen, pmom, nmom, fillShow } = { ...defaultInputs, ...inputs };
  const bull = '#00bcd4';
  const bear = '#ff5252';
  return {
    init() {
      const s: RmiRun = {
        rmaUp: taStep.rma(rmiLen), rmaDown: taStep.rma(rmiLen), mfi: taStep.mfi(rmiLen), ema: taStep.ema(5),
        atr: taStep.atr(30), rsiMfi: [], ema5: [], posArr: [], negArr: [], bandRaw: [], barRange: [], weightArr: [],
        cwArr: [], plots: Array.from({ length: 6 }, () => []), maxArr: [], rwmaValArr: [], minArr: [], colour75: [],
        barColors: [], candles: [], labels: [], flags: [[], []], times: [[], []],
        steps: [], vars: { positive: false, negative: false }, lists: [], series: [],
      };
      s.steps = [s.rmaUp, s.rmaDown, s.mfi, s.ema, s.atr];
      s.lists = [s.barColors, s.candles, s.labels, ...s.times];
      s.series = [
        s.rsiMfi, s.ema5, s.posArr, s.negArr, s.bandRaw, s.barRange, s.weightArr, s.cwArr, ...s.plots, s.maxArr,
        s.rwmaValArr, s.minArr, s.colour75, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      // Pine: up = ta.rma(math.max(ta.change(close), 0), Length)
      // Pine: down = ta.rma(-math.min(ta.change(close), 0), Length)
      // change(close) = close - close[1]
      let upRaw: number;
      let downRaw: number;
      if (i < 1 || b.close == null || bars[i - 1].close == null) {
        upRaw = 0;
        downRaw = 0;
      } else {
        const diff = b.close - bars[i - 1].close;
        upRaw = Math.max(0, diff);
        downRaw = Math.max(0, -diff);
      }
      const u = s.rmaUp.step(upRaw);
      const d = s.rmaDown.step(downRaw);

      // Pine: rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const r = d === 0 ? 100 : u === 0 ? 0 : 100 - (100 / (1 + u / d));

      // Pine: mf = ta.mfi(hlc3, Length)
      const m = s.mfi.step((b.high + b.low + b.close) / 3, b.volume ?? 0);

      // Pine: rsi_mfi = math.avg(rsi, mf)
      s.rsiMfi[i] = isNaN(r) || isNaN(m) ? NaN : (r + m) / 2;

      // Pine: EMA(close, 5)
      s.ema5[i] = s.ema.step(b.close);

      // Track positive/negative state
      if (i >= 1) {
        const cur = s.rsiMfi[i];
        const prev = s.rsiMfi[i - 1];
        if (!(isNaN(cur) || isNaN(prev))) {
          const emaChange = s.ema5[i] - s.ema5[i - 1];
          // Pine: p_mom = rsi_mfi[1] < pmom and rsi_mfi > pmom and rsi_mfi > nmom and change(ema5) > 0
          const pMom = prev < pmom && cur > pmom && cur > nmom && emaChange > 0;
          // Pine: n_mom = rsi_mfi < nmom and change(ema5) < 0
          const nMom = cur < nmom && emaChange < 0;
          if (pMom) { v.positive = true; v.negative = false; }
          if (nMom) { v.positive = false; v.negative = true; }
        }
        s.posArr[i] = v.positive;
        s.negArr[i] = v.negative;
      } else {
        s.posArr[i] = false;
        s.negArr[i] = false;
      }

      // Pine: Band = math.min(ta.atr(30) * 0.3, close * (0.3/100))[20] / 2 * 8
      const atrVal = s.atr.step(b.high, b.low, b.close);
      s.bandRaw[i] = Math.min(atrVal * 0.3, b.close * 0.003);
      const band = i >= 20 ? s.bandRaw[i - 20] / 2 * 8 : 0;

      // Compute RWMA: Range-weighted moving average
      // Pine: weight[j] = Range[j] / math.sum(Range, Prd)[j] where the sum is computed at each bar j
      // Then rwma[i] = math.sum(close * weight, 20)[i] / math.sum(weight, 20)[i]
      s.barRange[i] = b.high - b.low;
      // rolling 20-bar sum of barRange (the bars so far before bar 19)
      let rangeSum20 = 0;
      for (let j = i < 19 ? 0 : i - 19; j <= i; j++) rangeSum20 += s.barRange[j];
      // weight[i] = barRange[i] / rangeSum20[i]
      s.weightArr[i] = rangeSum20 > 0 ? s.barRange[i] / rangeSum20 : 0;
      // cwArr[i] = close[i] * weight[i]
      s.cwArr[i] = b.close * s.weightArr[i];
      // rwma[i] = sum(cwArr, 20)[i] / sum(weightArr, 20)[i]
      let rwma = NaN;
      if (i >= 19) {
        let sumCW = 0;
        let sumW = 0;
        for (let j = i - 19; j <= i; j++) {
          sumCW += s.cwArr[j];
          sumW += s.weightArr[j];
        }
        rwma = sumW > 0 ? sumCW / sumW : b.close;
      }

      // Build RWMA plot and labels
      const pos = s.posArr[i];
      const neg = s.negArr[i];

      // Pine: RWMA = positive ? rwma - Band : negative ? rwma + Band : na
      const showPlot = fillShow && !isNaN(rwma) && band > 0 && (pos || neg);
      const RWMA = pos ? rwma - band : neg ? rwma + band : NaN;
      // Pine: colour = positive ? bull : bear
      s.colour75[i] = color.new_color(pos ? bull : bear, 75) as string;
      if (!isNaN(rwma) && band > 0 && !isNaN(RWMA)) {
        // Pine: max = RWMA + Band, min = RWMA - Band
        s.maxArr[i] = RWMA + band;
        s.rwmaValArr[i] = RWMA;
        s.minArr[i] = RWMA - band;
      } else {
        s.maxArr[i] = NaN;
        s.rwmaValArr[i] = NaN;
        s.minArr[i] = NaN;
      }

      const p = s.plots;
      if (showPlot && !isNaN(RWMA)) {
        p[0][i] = { time, value: RWMA };
        p[1][i] = { time, value: RWMA };
        p[2][i] = { time, value: RWMA };
        p[3][i] = { time, value: RWMA };

        const maxVal = RWMA + band;
        const minVal = RWMA - band;

        // Pine: top = plot(max), bottom = plot(min), both transparent
        p[4][i] = { time, value: maxVal };
        p[5][i] = { time, value: minVal };

        // Buy label: positive and not positive[1]
        if (i > 0 && pos && !s.posArr[i - 1]) {
          s.labels.push({
            time,
            price: minVal - band / 2,
            text: '',
            color: '#4CAF50',
            textColor: '#FFFFFF',
            style: 'label_up',
            size: 'small',
          });
        }

        // Sell label: negative and not negative[1]
        if (i > 0 && neg && !s.negArr[i - 1]) {
          s.labels.push({
            time,
            price: maxVal + band / 2,
            text: '',
            color: '#FF0000',
            textColor: '#FFFFFF',
            style: 'label_down',
            size: 'small',
          });
        }
      } else {
        for (let k = 0; k < 6; k++) p[k][i] = { time, value: NaN };
      }

      // Pine: Barcol = positive ? color.green : color.red
      if (pos || neg) {
        const col = pos ? '#4CAF50' : '#FF0000';
        s.barColors.push({ time, color: col });
        s.candles.push({
          time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          color: col,
          borderColor: col,
          wickColor: col,
        });
      }

      // alertcondition(positive and not positive[1], "BUY") / alertcondition(negative and not negative[1], "SELL")
      const buy = pos && !(i > 0 && s.posArr[i - 1]);
      const sell = neg && !(i > 0 && s.negArr[i - 1]);
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      // Pine: alpha = color.new(color.black, 100)
      const alpha: string[] = new Array(n).fill('#00000000');
      const colour75 = s.colour75.slice();
      const maxArr = s.maxArr.slice();
      const rwmaValArr = s.rwmaValArr.slice();
      const minArr = s.minArr.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(), plot5: p[5].slice() },
        // Pine: fill(top, center, top_value = max, bottom_value = RWMA, bottom_color = color.new(colour, 75), top_color = alpha)
        // Pine: fill(center, bottom, top_value = RWMA, bottom_value = min, bottom_color = alpha, top_color = color.new(colour, 75))
        fills: [
          {
            plot1: 'plot4', plot2: 'plot0',
            gradient: { topValue: maxArr, bottomValue: rwmaValArr, topColor: alpha, bottomColor: colour75 },
          },
          {
            plot1: 'plot0', plot2: 'plot5',
            gradient: { topValue: rwmaValArr, bottomValue: minArr, topColor: colour75, bottomColor: alpha },
          },
        ],
        barColors: s.barColors.slice(),
        plotCandles: { candle0: s.candles.slice() },
        labels: s.labels.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      } as Omit<IndicatorResult, 'markers'> & {
        barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>; labels: LabelData[]; alerts: AlertConditionState[];
      } as Result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RMITrendSniperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RMITrendSniperInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message given: the default message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY', message: 'Alert Fired!' },
  { id: 'alert1', title: 'SELL', message: 'Alert Fired!' },
];

export const RMITrendSniper = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
