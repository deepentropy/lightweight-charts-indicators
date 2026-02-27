/**
 * RMI Trend Sniper
 *
 * Combines RSI (using change(close,1)) with MFI, averaged into rsi_mfi.
 * Trend flips bullish when rsi_mfi crosses above pmom with rising EMA(5),
 * bearish when rsi_mfi drops below nmom with falling EMA(5).
 * Overlay: Range-weighted MA band with ATR-derived width, colored candles, and buy/sell labels.
 *
 * Reference: TradingView "RMI Trend Sniper" by TZack88
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData, LabelData } from '../types';

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
];

export const metadata = {
  title: 'RMI Trend Sniper',
  shortTitle: 'RMI Sniper',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RMITrendSniperInputs> = {}): IndicatorResult {
  const { rmiLen, pmom, nmom, fillShow } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const hlc3 = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const volume = new Series(bars, (b) => b.volume ?? 0);

  // Pine: up = ta.rma(math.max(ta.change(close), 0), Length)
  // Pine: down = ta.rma(-math.min(ta.change(close), 0), Length)
  // change(close) = close - close[1]
  const closeArr = close.toArray();
  const upRaw: number[] = new Array(n);
  const downRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < 1 || closeArr[i] == null || closeArr[i - 1] == null) {
      upRaw[i] = 0;
      downRaw[i] = 0;
    } else {
      const diff = closeArr[i]! - closeArr[i - 1]!;
      upRaw[i] = Math.max(0, diff);
      downRaw[i] = Math.max(0, -diff);
    }
  }

  const upSeries = Series.fromArray(bars, upRaw);
  const downSeries = Series.fromArray(bars, downRaw);
  const rmaUp = ta.rma(upSeries, rmiLen).toArray();
  const rmaDown = ta.rma(downSeries, rmiLen).toArray();

  // Pine: rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
  const rsiArr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const u = rmaUp[i];
    const d = rmaDown[i];
    if (u == null || d == null) continue;
    rsiArr[i] = d === 0 ? 100 : u === 0 ? 0 : 100 - (100 / (1 + u / d));
  }

  // Pine: mf = ta.mfi(hlc3, Length)
  const mfiArr = ta.mfi(hlc3, rmiLen, volume).toArray();

  // Pine: rsi_mfi = math.avg(rsi, mf)
  const rsiMfi: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const r = rsiArr[i];
    const m = mfiArr[i];
    if (r == null || isNaN(r) || m == null || isNaN(m)) continue;
    rsiMfi[i] = (r + m) / 2;
  }

  // Pine: EMA(close, 5)
  const ema5 = ta.ema(close, 5).toArray();

  // Track positive/negative state
  let positive = false;
  let negative = false;
  const posArr: boolean[] = new Array(n).fill(false);
  const negArr: boolean[] = new Array(n).fill(false);

  for (let i = 1; i < n; i++) {
    const cur = rsiMfi[i];
    const prev = rsiMfi[i - 1];
    if (isNaN(cur) || isNaN(prev)) {
      posArr[i] = positive;
      negArr[i] = negative;
      continue;
    }

    const emaChange = (ema5[i] ?? 0) - (ema5[i - 1] ?? 0);

    // Pine: p_mom = rsi_mfi[1] < pmom and rsi_mfi > pmom and rsi_mfi > nmom and change(ema5) > 0
    const pMom = prev < pmom && cur > pmom && cur > nmom && emaChange > 0;
    // Pine: n_mom = rsi_mfi < nmom and change(ema5) < 0
    const nMom = cur < nmom && emaChange < 0;

    if (pMom) { positive = true; negative = false; }
    if (nMom) { positive = false; negative = true; }

    posArr[i] = positive;
    negArr[i] = negative;
  }

  // Pine: Band = math.min(ta.atr(30) * 0.3, close * (0.3/100))[20] / 2 * 8
  const atrArr = ta.atr(bars, 30).toArray();
  const bandRaw: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const atrVal = atrArr[i] ?? 0;
    bandRaw[i] = Math.min(atrVal * 0.3, bars[i].close * 0.003);
  }
  const bandArr: number[] = new Array(n).fill(0);
  for (let i = 20; i < n; i++) {
    bandArr[i] = bandRaw[i - 20] / 2 * 8;
  }

  // Compute RWMA: Range-weighted moving average
  // Pine: weight[j] = Range[j] / math.sum(Range, Prd)[j] where the sum is computed at each bar j
  // Then rwma[i] = math.sum(close * weight, 20)[i] / math.sum(weight, 20)[i]
  const barRange: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    barRange[i] = bars[i].high - bars[i].low;
  }

  // Compute rolling 20-bar sum of barRange for each bar
  const rangeSum20: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i < 19) {
      // Not enough bars yet for full window
      let s = 0;
      for (let j = 0; j <= i; j++) s += barRange[j];
      rangeSum20[i] = s;
    } else {
      let s = 0;
      for (let j = i - 19; j <= i; j++) s += barRange[j];
      rangeSum20[i] = s;
    }
  }

  // weight[i] = barRange[i] / rangeSum20[i]
  const weightArr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    weightArr[i] = rangeSum20[i] > 0 ? barRange[i] / rangeSum20[i] : 0;
  }

  // cwArr[i] = close[i] * weight[i]
  const cwArr: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    cwArr[i] = bars[i].close * weightArr[i];
  }

  // rwma[i] = sum(cwArr, 20)[i] / sum(weightArr, 20)[i]
  const rwmaArr: number[] = new Array(n).fill(NaN);
  for (let i = 19; i < n; i++) {
    let sumCW = 0;
    let sumW = 0;
    for (let j = i - 19; j <= i; j++) {
      sumCW += cwArr[j];
      sumW += weightArr[j];
    }
    rwmaArr[i] = sumW > 0 ? sumCW / sumW : bars[i].close;
  }

  // Build RWMA plot and labels
  const bull = '#00bcd4';
  const bear = '#ff5252';

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const barColors: BarColorData[] = [];
  const candles: PlotCandleData[] = [];
  const labels: LabelData[] = [];

  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const rwma = rwmaArr[i];
    const band = bandArr[i];
    const pos = posArr[i];
    const neg = negArr[i];

    // Pine: RWMA = positive ? rwma - Band : negative ? rwma + Band : na
    const showPlot = fillShow && !isNaN(rwma) && band > 0 && (pos || neg);
    const RWMA = pos ? rwma - band : neg ? rwma + band : NaN;

    if (showPlot && !isNaN(RWMA)) {
      const colour = pos ? bull : bear;
      plot0.push({ time, value: RWMA });
      plot1.push({ time, value: RWMA });
      plot2.push({ time, value: RWMA });
      plot3.push({ time, value: RWMA });

      const maxVal = RWMA + band;
      const minVal = RWMA - band;

      // Buy label: positive and not positive[1]
      if (i > 0 && pos && !posArr[i - 1]) {
        labels.push({
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
      if (i > 0 && neg && !negArr[i - 1]) {
        labels.push({
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
      plot0.push({ time, value: NaN });
      plot1.push({ time, value: NaN });
      plot2.push({ time, value: NaN });
      plot3.push({ time, value: NaN });
    }

    // Pine: Barcol = positive ? color.green : color.red
    if (pos || neg) {
      const col = pos ? '#4CAF50' : '#FF0000';
      barColors.push({ time, color: col });
      candles.push({
        time,
        open: bars[i].open,
        high: bars[i].high,
        low: bars[i].low,
        close: bars[i].close,
        color: col,
        borderColor: col,
        wickColor: col,
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    barColors,
    plotCandles: { candle0: candles },
    labels,
  } as IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]>; labels: LabelData[] };
}

export const RMITrendSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
