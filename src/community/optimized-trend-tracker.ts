/**
 * Optimized Trend Tracker (OTT)
 *
 * Smoothed moving average with percentage-based trailing stop.
 * Support line (MA) determines trend direction;
 * OTT = MA * (200 ± percent) / 200 based on which side of trailing stop.
 * VAR moving average as the original: vCMO = nz((sum(vud1, 9) - sum(vdd1, 9)) / (sum + sum)), 0 until the 9-bar
 * sums exist, VAR = nz(valpha * |vCMO| * src) + (1 - valpha * |vCMO|) * nz(VAR[1]) (it starts from 0).
 * Buy / Sell labels (plotshape, location absolute, as the original): at OTT * 0.995 under / OTT * 1.005 over, green
 * #4CAF50 / red #FF5252 with white text, from the first bar where the crosses exist; the support line crossing
 * labels behind "Show Support Line Crossing Signals?" (on), the others behind their inputs (off).
 * Lines from bar 0, as the original: the support line (VAR, 0 until its 9-bar sums exist) behind "Show Support
 * Line?", OTT plotted as nz(OTT[2]) (0 on the first two bars), purple #B800D9, or green / red by OTT[2] against
 * OTT[3] with "Show OTT Color Changes?" (off). Highlighter fills ("Highlighter On/Off ?", on) green / red where the
 * support line is above / below OTT.
 * Alerts (alertcondition, `alerts` of the result): the 9 conditions of the original (OTT colour change, support
 * line / OTT crosses, price / OTT crosses) on the same crosses as the labels (OTT[2] = OTT two bars back).
 *
 * Reference: "Optimized Trend Tracker" by KivancOzbilgic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OTTInputs {
  source: SourceType;
  period: number;
  percent: number;
  /** Show Support Line? */
  showSupport: boolean;
  /** Show Support Line Crossing Signals? */
  showSignalsK: boolean;
  showSignalsC: boolean;
  /** Show OTT Color Changes? */
  highlight: boolean;
  showSignalsR: boolean;
  /** Highlighter On/Off ? */
  highlighting: boolean;
}

export const defaultInputs: OTTInputs = {
  source: 'close',
  period: 2,
  percent: 1.4,
  showSupport: true,
  showSignalsK: true,
  showSignalsC: false,
  highlight: false,
  showSignalsR: false,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Percent', defval: 1.4, min: 0, step: 0.1 },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: true },
  { id: 'showSignalsK', type: 'bool', title: 'Show Support Line Crossing Signals?', defval: true },
  { id: 'showSignalsC', type: 'bool', title: 'Show Price/OTT Crossing Signals?', defval: false },
  { id: 'highlight', type: 'bool', title: 'Show OTT Color Changes?', defval: false },
  { id: 'showSignalsR', type: 'bool', title: 'Show OTT Color Change Signals?', defval: false },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
  { id: 'plot1', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  // mPlot = plot(ohlc4, display = display.none): one side of the highlighter fills
  { id: 'plot2', title: 'OHLC4', color: '#2196F3', lineWidth: 1, style: 'circles', display: 'none' },
];

export const metadata = {
  title: 'Optimized Trend Tracker',
  shortTitle: 'OTT',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface OttRun extends BarRunState<Record<string, never>> {
  srcArr: number[];
  mavg: number[];
  vud1: number[];
  vdd1: number[];
  longStop: number[];
  shortStop: number[];
  dir: number[];
  ott: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  upFill: string[];
  downFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<OTTInputs>): BarStudy<OttRun, Result> {
  const { source, period, percent, showSupport, showSignalsK, showSignalsC, highlight, showSignalsR, highlighting } =
    { ...defaultInputs, ...inputs };
  const value = barSource(source);
  // VAR calculation (Pine Var_Func)
  const valpha = 2 / (period + 1);
  const green = '#4CAF50', red = '#FF5252', white = '#FFFFFF';
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      const s: OttRun = {
        srcArr: [], mavg: [], vud1: [], vdd1: [], longStop: [], shortStop: [], dir: [], ott: [], plot0: [], plot1: [],
        plot2: [], upFill: [], downFill: [], markers: [], flags: Array.from({ length: 9 }, () => []),
        times: Array.from({ length: 9 }, () => []), steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.srcArr, s.mavg, s.vud1, s.vdd1, s.longStop, s.shortStop, s.dir, s.ott, s.plot0, s.plot1, s.plot2, s.upFill,
        s.downFill, ...s.flags,
      ];
      return s;
    },
    bar(st, i, bars) {
      const { srcArr, mavg, vud1, vdd1, longStop, shortStop, dir, ott } = st;
      const b = bars[i];
      const time = b.time;
      // Default MA type is VAR (Variable Index Dynamic Average)
      srcArr[i] = value(b);
      const s = srcArr[i] ?? NaN;
      const ps = i > 0 ? (srcArr[i - 1] ?? NaN) : NaN;
      // vud1 = src > src[1] ? src - src[1] : 0 (0 when src[1] is na)
      vud1[i] = s > ps ? s - ps : 0;
      vdd1[i] = s < ps ? ps - s : 0;
      // vUD = sum(vud1, 9), vDD = sum(vdd1, 9): na before the 9th bar
      let vCMO = 0;
      if (i >= 8) {
        let vUD = 0, vDD = 0;
        for (let j = i - 8; j <= i; j++) { vUD += vud1[j]; vDD += vdd1[j]; }
        const c = (vUD - vDD) / (vUD + vDD);
        vCMO = Number.isFinite(c) ? c : 0; // nz()
      }
      const k = valpha * Math.abs(vCMO);
      const term = k * s;
      mavg[i] = (Number.isFinite(term) ? term : 0) + (1 - k) * (i > 0 ? mavg[i - 1] : 0);

      // Trailing stop logic
      const fark = mavg[i] * percent * 0.01;
      longStop[i] = mavg[i] - fark;
      shortStop[i] = mavg[i] + fark;

      if (i > 0) {
        if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
        if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

        dir[i] = dir[i - 1];
        if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
        else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
      } else {
        dir[i] = 1;
      }

      const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
      ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;

      // plot(showsupport ? MAvg : na, "Support Line"): from bar 0 (VAR starts from 0)
      st.plot0[i] = { time, value: showSupport ? mavg[i] : NaN };
      // pALL = plot(nz(OTT[2]), color = OTTC, "OTT"): 0 on the first two bars;
      // OTTC = highlight ? OTT[2] > OTT[3] ? color.green : color.red : #B800D9 (na compares false: red)
      const ottLag = i >= 2 ? ott[i - 2] : NaN;
      const ottLagPrev = i >= 3 ? ott[i - 3] : NaN;
      const color = highlight ? (ottLag > ottLagPrev ? '#4CAF50' : '#FF5252') : '#B800D9';
      st.plot1[i] = { time, value: Number.isFinite(ottLag) ? ottLag : 0, color };

      // mPlot = plot(ohlc4, display = display.none)
      st.plot2[i] = { time, value: (b.open + b.high + b.low + b.close) / 4 };
      // fill(mPlot, pALL, "UpTrend Highligter", highlighting ? (MAvg > OTT ? color.green : na) : na) /
      // fill(mPlot, pALL, "DownTrend Highligter", highlighting ? (MAvg < OTT ? color.red : na) : na)
      st.upFill[i] = highlighting && mavg[i] > ott[i] ? 'rgba(76,175,80,0.15)' : 'transparent';
      st.downFill[i] = highlighting && mavg[i] < ott[i] ? 'rgba(255,82,82,0.15)' : 'transparent';

      // Crosses (Pine: crossover / crossunder of MAvg, src and OTT[2] with OTT[2] / OTT[3]; OTT[2] / OTT[3] are na on
      // the first bars). The alerts read the same crosses.
      const ott2 = ottLag;
      const ott3 = ottLagPrev;
      const pOtt2 = i >= 3 ? ott[i - 3] : NaN;
      const pOtt3 = i >= 4 ? ott[i - 4] : NaN;
      const pMavg = i > 0 ? mavg[i - 1] : NaN;
      const pSrc = i > 0 ? srcArr[i - 1] ?? NaN : NaN;
      const colorUp = ott2 > ott3 && pOtt2 <= pOtt3, colorDown = ott2 < ott3 && pOtt2 >= pOtt3;
      const supUp = mavg[i] > ott2 && pMavg <= pOtt2, supDown = mavg[i] < ott2 && pMavg >= pOtt2;
      const priceUp = s > ott2 && pSrc <= pOtt2, priceDown = s < ott2 && pSrc >= pOtt2;

      // Markers (plotshape order): support line crosses (showsignalsk, on by default), price crosses (showsignalsc),
      // OTT colour changes (showsignalsr); Buy at OTT * 0.995 (labelup under it), Sell at OTT * 1.005 (labeldown over it)
      const buy = (id: string): MarkerData => ({ id, time, position: 'atPriceBottom', price: ott[i] * 0.995,
        shape: 'labelUp', color: green, text: 'Buy', textColor: white, size: 'tiny' });
      const sell = (id: string): MarkerData => ({ id, time, position: 'atPriceTop', price: ott[i] * 1.005,
        shape: 'labelDown', color: red, text: 'Sell', textColor: white, size: 'tiny' });
      const markers = st.markers;
      if (showSignalsK && supUp) markers.push(buy('shape0'));
      if (showSignalsK && supDown) markers.push(sell('shape1'));
      if (showSignalsC && priceUp) markers.push(buy('shape2'));
      if (showSignalsC && priceDown) markers.push(sell('shape3'));
      if (showSignalsR && colorUp) markers.push(buy('shape4'));
      if (showSignalsR && colorDown) markers.push(sell('shape5'));

      // alertcondition(cross / crossover / crossunder of OTT[2] and OTT[3], MAvg and OTT[2], src and OTT[2])
      const flags = [
        colorUp || colorDown, colorUp, colorDown,
        supUp || supDown, supUp, supDown,
        priceUp || priceDown, priceUp, priceDown,
      ];
      for (let f = 0; f < flags.length; f++) {
        st.flags[f][i] = flags[f];
        if (flags[f]) st.times[f].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'UpTrend Highligter' }, colors: s.upFill.slice() },
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'DownTrend Highligter' }, colors: s.downFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OTTInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OTTInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Color ALARM', message: 'OTT Has Changed Color!' },
  { id: 'alert1', title: 'GREEN ALERT', message: 'OTT GREEN BUY SIGNAL!' },
  { id: 'alert2', title: 'RED ALERT', message: 'OTT RED SELL SIGNAL!' },
  { id: 'alert3', title: 'Cross Alert', message: 'OTT - Support Line Crossing!' },
  { id: 'alert4', title: 'Crossover Alarm', message: 'Support Line BUY SIGNAL!' },
  { id: 'alert5', title: 'Crossunder Alarm', message: 'Support Line SELL SIGNAL!' },
  { id: 'alert6', title: 'Price Cross Alert', message: 'OTT - Price Crossing!' },
  { id: 'alert7', title: 'Price Crossover Alarm', message: 'PRICE OVER OTT - BUY SIGNAL!' },
  { id: 'alert8', title: 'Price Crossunder Alarm', message: 'PRICE UNDER OTT - SELL SIGNAL!' },
];

export const OptimizedTrendTracker = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
