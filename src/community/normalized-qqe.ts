/**
 * Normalized QQE (nQQE)
 *
 * Smoothed RSI with a QQE trailing stop, normalized around zero.
 * QQEF = EMA(RSI, SF) − 50, QQES trailing stop − 50.
 * ATR of RSI uses double-WWMA (alpha = 1/length).
 *
 * Pine source: "Normalized Quantitative Qualitative Estimation" by KivancOzbilgic
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface NormalizedQQEInputs {
  rsiLen: number;
  smoothFactor: number;
  qqeFactor: number;
  src: SourceType;
  showSignals: boolean;
}

export const defaultInputs: NormalizedQQEInputs = {
  rsiLen: 14,
  smoothFactor: 5,
  qqeFactor: 4.236,
  src: 'close',
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothFactor', type: 'int', title: 'Smooth Factor', defval: 5, min: 1 },
  { id: 'qqeFactor', type: 'float', title: 'QQE Factor', defval: 4.236, min: 0.01, step: 0.001 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'SLOW', color: '#0007E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Normalized QQE',
  shortTitle: 'nQQE',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<NormalizedQQEInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, smoothFactor, qqeFactor, src, showSignals } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  // Pine: RSII=ema(rsi(src,length),SSF)  /  QQEF=ema(rsi(src,length),SSF)
  const smoothedRsi = ta.ema(rsi, smoothFactor);
  const QQEF = smoothedRsi.toArray();

  // Pine: TR=abs(RSII-RSII[1])
  const TR: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const cur = QQEF[i] ?? 0;
    const prev = i > 0 ? (QQEF[i - 1] ?? 0) : 0;
    TR[i] = Math.abs(cur - prev);
  }

  // Pine: wwalpha = 1/length
  // Pine: WWMA := wwalpha*TR + (1-wwalpha)*nz(WWMA[1])
  // Pine: ATRRSI := wwalpha*WWMA + (1-wwalpha)*nz(ATRRSI[1])
  // Two passes of recursive filter with alpha = 1/rsiLen
  const wwalpha = 1 / rsiLen;
  const WWMA: number[] = new Array(n);
  const ATRRSI: number[] = new Array(n);
  WWMA[0] = TR[0];
  ATRRSI[0] = WWMA[0];
  for (let i = 1; i < n; i++) {
    WWMA[i] = wwalpha * TR[i] + (1 - wwalpha) * WWMA[i - 1];
    ATRRSI[i] = wwalpha * WWMA[i] + (1 - wwalpha) * ATRRSI[i - 1];
  }

  // Pine: QUP=QQEF+ATRRSI*4.236, QDN=QQEF-ATRRSI*4.236
  // Pine: QQES:=QUP<nz(QQES[1]) ? QUP
  //            : QQEF>nz(QQES[1]) and QQEF[1]<nz(QQES[1]) ? QDN
  //            : QDN>nz(QQES[1]) ? QDN
  //            : QQEF<nz(QQES[1]) and QQEF[1]>nz(QQES[1]) ? QUP
  //            : nz(QQES[1])
  const QQES: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = QQEF[i] ?? 0;
    const dar = ATRRSI[i] * qqeFactor;
    const QUP = f + dar;
    const QDN = f - dar;

    if (i === 0) {
      QQES[i] = 0;
    } else {
      const prevS = QQES[i - 1];
      const prevF = QQEF[i - 1] ?? 0;
      if (QUP < prevS) {
        QQES[i] = QUP;
      } else if (f > prevS && prevF < prevS) {
        QQES[i] = QDN;
      } else if (QDN > prevS) {
        QQES[i] = QDN;
      } else if (f < prevS && prevF > prevS) {
        QQES[i] = QUP;
      } else {
        QQES[i] = prevS;
      }
    }
  }

  const warmup = rsiLen + smoothFactor;

  // Pine: QQF=plot(QQEF-50,"FAST",color=color.maroon,linewidth=2)
  // Pine: plot(QQEF-50,color=Colorh,linewidth=2,style=5)  -- colored overlay
  // Pine: Colorh = QQEF-50>10 ? #007002 : QQEF-50<-10 ? color.red : #E8E81A
  const plot0 = QQEF.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const val = v - 50;
    const color = val > 10 ? '#007002' : val < -10 ? '#FF0000' : '#E8E81A';
    return { time: bars[i].time, value: val, color };
  });

  // Pine: QQS=plot(QQES-50,"SLOW",color=#0007E1,linewidth=2)
  const plot1 = QQES.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v - 50 };
  });

  // Pine: buySignalr = crossover(QQEF, QQES)
  // Pine: plotshape(buySignalr and showsignals ? (QQES-50)*0.995 : na, ...)
  // Pine: sellSignallr = crossunder(QQEF, QQES)
  // Pine: plotshape(sellSignallr and showsignals ? (QQES-50)*1.005 : na, ...)
  const markers: MarkerData[] = [];
  if (showSignals) {
    for (let i = warmup; i < n; i++) {
      const curF = QQEF[i] ?? 0;
      const prevF = QQEF[i - 1] ?? 0;
      const curS = QQES[i];
      const prevS = QQES[i - 1];
      if (prevF <= prevS && curF > curS) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: 'Buy' });
      } else if (prevF >= prevS && curF < curS) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: -10, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
    markers,
  };
}

export const NormalizedQQE = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
