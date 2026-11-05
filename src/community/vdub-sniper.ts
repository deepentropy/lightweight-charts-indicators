/**
 * Vdub FX SniperVX2 Color v2
 *
 * Overlay indicator (overlay=true) with:
 * - Candle body channel (highest/lowest of close over 13 bars), linebr, drawn only while the level is unchanged
 * - LB Resistance channel (self-referencing up/down), linebr, drawn only while the level is unchanged
 * - S/R lines: valuewhen(high >= highest(high, 6), high, 0) and valuewhen(low <= lowest(low, 6), low, 0),
 *   plotted on every bar with an na colour on the bars where the level changes
 * - EMA 13 and EMA 21 coloured by direction (lime rising, red falling, na colour otherwise)
 * - Hull MA (black, linewidth 3)
 * - Buy/Sell markers from TEMA/DEMA signal logic
 * - Supertrend arrows on trend change (the original's plotarrow outputs: `arrows` of the result)
 * - Fills: body channel (black), resistance (red), support (green)
 *
 * Pine v1/v2 source: plots without transp use transparency 35.
 *
 * Reference: "Vdub FX SniperVX2 Color v2" by Vdubus
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VdubSniperInputs {
  src: SourceType;
  channel2: boolean;
  channel: boolean;
  bodyChannelLen: number;
  bodyChannelPeriod: number;
  ema1Len: number;
  ema2Len: number;
  fastSignal: number;
  slowSignal: number;
  supertrendFactor: number;
  supertrendPeriod: number;
  sRLength: number;
  showHma: boolean;
  hmaSrc: SourceType;
  hmaBaseLength: number;
  hmaLengthScalar: number;
}

export const defaultInputs: VdubSniperInputs = {
  src: 'close',
  channel2: false,
  channel: false,
  bodyChannelLen: 34,
  bodyChannelPeriod: 13,
  ema1Len: 13,
  ema2Len: 21,
  fastSignal: 5,
  slowSignal: 8,
  supertrendFactor: 3,
  supertrendPeriod: 1,
  sRLength: 6,
  showHma: true,
  hmaSrc: 'close',
  hmaBaseLength: 8,
  hmaLengthScalar: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Candle body resistance Channel', defval: 'close' },
  { id: 'channel2', type: 'bool', title: 'Bar Channel On/Off', defval: false },
  { id: 'channel', type: 'bool', title: 'Resistance Channel 2 On/Off', defval: false },
  { id: 'bodyChannelLen', type: 'int', title: 'Candle Body Resistance Channel', defval: 34, min: 1 },
  { id: 'bodyChannelPeriod', type: 'int', title: 'Channel Period', defval: 13, min: 1 },
  { id: 'sRLength', type: 'int', title: 'Support / Resistance length:', defval: 6 },
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 13, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 21, min: 1 },
  { id: 'fastSignal', type: 'int', title: 'Short Signal Generator', defval: 5, min: 1 },
  { id: 'slowSignal', type: 'int', title: 'slow', defval: 8, min: 1 },
  { id: 'supertrendFactor', type: 'int', title: 'Trend Transition Signal', defval: 3, min: 1, max: 1000 },
  { id: 'supertrendPeriod', type: 'int', title: 'Period', defval: 1, min: 1, max: 1000 },
  { id: 'showHma', type: 'bool', title: 'Display Hull MA Set:', defval: true },
  { id: 'hmaSrc', type: 'source', title: "Hull MA's Source:", defval: 'close' },
  { id: 'hmaBaseLength', type: 'int', title: "Hull MA's Base Length:", defval: 8, min: 1 },
  { id: 'hmaLengthScalar', type: 'int', title: "Hull MA's Length Scalar:", defval: 5, min: 0 },
];

// Pine v1/v2 colours (transparency 35 unless set): black #000000, red #FF0000, green #008000, lime #00FF00
const BLACK = '#000000a6';
const RED = '#FF0000a6';
const GREEN = '#008000a6';
const LIME = '#00FF00a6';

export const plotConfig: PlotConfig[] = [
  { id: 'channelTop', title: 'Candle body resistance level top', color: BLACK, lineWidth: 1, style: 'linebr' },
  { id: 'channelBottom', title: 'Candle body resistance level bottom', color: BLACK, lineWidth: 1, style: 'linebr' },
  { id: 'resistTop', title: 'Resistance Level top', color: RED, lineWidth: 1, style: 'linebr' },
  { id: 'resistBottom', title: 'Resistance level bottom', color: GREEN, lineWidth: 1, style: 'linebr' },
  { id: 'srTop', title: 'Plot', color: RED, lineWidth: 1 },
  { id: 'srBottom', title: 'Plot', color: GREEN, lineWidth: 1 },
  { id: 'ema1', title: 'EMA', color: LIME, lineWidth: 1 },
  { id: 'ema2', title: 'EMA Signal 2', color: LIME, lineWidth: 1 },
  { id: 'hullMA', title: 'Hull MA', color: BLACK, lineWidth: 3 },
];

export const metadata = {
  title: 'Vdub FX Sniper',
  shortTitle: 'VSniper',
  overlay: true,
};

type Pt = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[] };
type Ema = ReturnType<typeof taStep.ema>;
type Ext = ReturnType<typeof taStep.highest>;

/** PineScript `a > b` / `a < b` of two finite numbers (tolerance 1e-10), the comparisons of ta.rising / ta.falling */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;

interface VdubVars {
  /** valuewhen(high >= highest(high, RST), high, 0) / valuewhen(low <= lowest(low, RST), low, 0) */
  lastT: number;
  lastB: number;
  /** ta.rising(ema, 2) / ta.falling(ema, 2) counters of EMA 1 and EMA 2 */
  rise1: number;
  fall1: number;
  rise2: number;
  fall2: number;
}

interface VdubRun extends BarRunState<VdubVars> {
  last8h: Ext;
  lastl8: Ext;
  highestH: Ext;
  lowestL: Ext;
  ema1: Ema;
  ema2: Ema;
  hma: ReturnType<typeof taStep.hma>;
  vh1High: Ext;
  vh1: Ema;
  vl1Low: Ext;
  vl1: Ema;
  e1: Ema;
  e2: Ema;
  e3: Ema;
  ee1: Ema;
  ee2: Ema;
  atr: ReturnType<typeof taStep.atr>;
  close: number[];
  last8hArr: number[];
  lastl8Arr: number[];
  upArr: number[];
  downArr: number[];
  rstt: number[];
  rstb: number[];
  ema1Arr: number[];
  ema2Arr: number[];
  signal: number[];
  trendUp: number[];
  trendDown: number[];
  trend: number[];
  channelTop: Pt[];
  channelBottom: Pt[];
  resistTop: Pt[];
  resistBottom: Pt[];
  srTop: Pt[];
  srBottom: Pt[];
  ema1Plot: Pt[];
  ema2Plot: Pt[];
  hullMA: Pt[];
  markers: MarkerData[];
  arrows: ArrowData[];
}

function study(inputs: Partial<VdubSniperInputs>): BarStudy<VdubRun, Result> {
  const {
    channel2, channel,
    bodyChannelPeriod,
    ema1Len, ema2Len,
    fastSignal, slowSignal,
    supertrendFactor, supertrendPeriod,
    sRLength,
    showHma, hmaSrc,
    hmaBaseLength, hmaLengthScalar,
  } = { ...defaultInputs, ...inputs };
  // Pine: src = input(close) only feeds out = sma(src, 34), which feeds bearish / bullish; none of them is plotted.
  const hmaValue = barSource(hmaSrc);
  const hmaLen = hmaBaseLength + hmaLengthScalar * 6;
  const nz = (v: number | undefined) => (v === undefined || isNaN(v) ? 0 : v);
  // Pine: plot(channel2 ? last8h : last8h == nz(last8h[1]) ? last8h : na, style = linebr)
  const stablePoint = (time: number, v: number, prev: number | undefined, always: boolean): Pt => {
    if (v == null || isNaN(v)) return { time, value: NaN };
    if (always) return { time, value: v };
    return { time, value: v === nz(prev) ? v : NaN };
  };
  // plot(RSTT, color = RSTT != RSTT[1] ? na : red): the value is plotted on every bar, transparent where it changes
  // (a comparison with na is na, so the colour stays red on the first bar with a value)
  const levelPoint = (time: number, v: number, prev: number, col: string): Pt => {
    if (isNaN(v)) return { time, value: NaN };
    return { time, value: v, color: !isNaN(prev) && v !== prev ? 'transparent' : col };
  };
  return {
    fullRunReason: () => (isBarSource(hmaSrc) ? null : 'source of another study'),
    init() {
      const s: VdubRun = {
        last8h: taStep.highest(), lastl8: taStep.lowest(), highestH: taStep.highest(), lowestL: taStep.lowest(),
        ema1: taStep.ema(ema1Len), ema2: taStep.ema(ema2Len), hma: taStep.hma(hmaLen),
        vh1High: taStep.highest(), vh1: taStep.ema(5), vl1Low: taStep.lowest(), vl1: taStep.ema(8),
        e1: taStep.ema(1), e2: taStep.ema(1), e3: taStep.ema(1), ee1: taStep.ema(8), ee2: taStep.ema(5),
        atr: taStep.atr(supertrendPeriod),
        close: [], last8hArr: [], lastl8Arr: [], upArr: [], downArr: [], rstt: [], rstb: [], ema1Arr: [], ema2Arr: [],
        signal: [], trendUp: [], trendDown: [], trend: [],
        channelTop: [], channelBottom: [], resistTop: [], resistBottom: [], srTop: [], srBottom: [], ema1Plot: [],
        ema2Plot: [], hullMA: [], markers: [], arrows: [],
        steps: [],
        vars: { lastT: NaN, lastB: NaN, rise1: 0, fall1: 0, rise2: 0, fall2: 0 },
        lists: [], series: [],
      };
      s.steps = [
        s.last8h, s.lastl8, s.highestH, s.lowestL, s.ema1, s.ema2, s.hma, s.vh1High, s.vh1, s.vl1Low, s.vl1, s.e1,
        s.e2, s.e3, s.ee1, s.ee2, s.atr,
      ];
      s.lists = [s.markers, s.arrows];
      s.series = [
        s.close, s.last8hArr, s.lastl8Arr, s.upArr, s.downArr, s.rstt, s.rstb, s.ema1Arr, s.ema2Arr, s.signal,
        s.trendUp, s.trendDown, s.trend, s.channelTop, s.channelBottom, s.resistTop, s.resistBottom, s.srTop,
        s.srBottom, s.ema1Plot, s.ema2Plot, s.hullMA,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = b.close;
      const high = b.high;
      const low = b.low;
      const v = s.vars;
      s.close[i] = c;

      // ===== Candle body resistance Channel (ul2/ll2) =====
      const h8 = s.last8h.step(c, bodyChannelPeriod);
      const l8 = s.lastl8.step(c, bodyChannelPeriod);
      s.last8hArr[i] = h8;
      s.lastl8Arr[i] = l8;
      s.channelTop[i] = stablePoint(time, h8, i > 0 ? s.last8hArr[i - 1] : undefined, channel2);
      s.channelBottom[i] = stablePoint(time, l8, i > 0 ? s.lastl8Arr[i - 1] : undefined, channel2);

      // ===== LB Resistance Channel (ul/ll) =====
      // up = close<nz(up[1]) and close>down[1] ? nz(up[1]) : high
      // down = close<nz(up[1]) and close>down[1] ? nz(down[1]) : low
      const prevUp = nz(i > 0 ? s.upArr[i - 1] : undefined);
      const prevDown = i > 0 ? s.downArr[i - 1] : NaN; // down[1] (na on the first bar: comparison false)
      if (c < prevUp && c > prevDown) {
        s.upArr[i] = prevUp;
        s.downArr[i] = nz(prevDown);
      } else {
        s.upArr[i] = high;
        s.downArr[i] = low;
      }
      // Pine: plot(channel ? up : up == nz(up[1]) ? up : na, style = linebr)
      s.resistTop[i] = stablePoint(time, s.upArr[i], i > 0 ? s.upArr[i - 1] : undefined, channel);
      s.resistBottom[i] = stablePoint(time, s.downArr[i], i > 0 ? s.downArr[i - 1] : undefined, channel);

      // ===== Support and Resistance (RT2/RB2) =====
      // RSTT = valuewhen(high >= highest(high, RST), high, 0); RSTB = valuewhen(low <= lowest(low, RST), low, 0)
      const hh = s.highestH.step(high, sRLength);
      const ll = s.lowestL.step(low, sRLength);
      if (high >= hh) v.lastT = high;
      if (low <= ll) v.lastB = low;
      s.rstt[i] = v.lastT;
      s.rstb[i] = v.lastB;
      s.srTop[i] = levelPoint(time, v.lastT, i > 0 ? s.rstt[i - 1] : NaN, RED);
      s.srBottom[i] = levelPoint(time, v.lastB, i > 0 ? s.rstb[i - 1] : NaN, GREEN);

      // ===== Trend colour EMA 1 / EMA 2 =====
      // direction = rising(ema0, 2) ? +1 : falling(ema0, 2) ? -1 : 0 (counters of rises / falls from the previous
      // bar; a step from or to an na value keeps them)
      // plot(ema0, color = direction > 0 ? lime : direction < 0 ? red : na): value on every bar, na colour when 0
      const em1 = s.ema1.step(c);
      const em2 = s.ema2.step(c);
      s.ema1Arr[i] = em1;
      s.ema2Arr[i] = em2;
      const p1 = i > 0 ? s.ema1Arr[i - 1] : NaN;
      const p2 = i > 0 ? s.ema2Arr[i - 1] : NaN;
      if (Number.isFinite(em1) && Number.isFinite(p1)) {
        v.rise1 = gt(em1, p1) ? v.rise1 + 1 : 0;
        v.fall1 = lt(em1, p1) ? v.fall1 + 1 : 0;
      }
      if (Number.isFinite(em2) && Number.isFinite(p2)) {
        v.rise2 = gt(em2, p2) ? v.rise2 + 1 : 0;
        v.fall2 = lt(em2, p2) ? v.fall2 + 1 : 0;
      }
      const dir = v.rise1 >= 2 ? 1 : v.fall1 >= 2 ? -1 : 0;
      const dir2 = v.rise2 >= 2 ? 1 : v.fall2 >= 2 ? -1 : 0;
      s.ema1Plot[i] = em1 == null || isNaN(em1) ? { time, value: NaN }
        : { time, value: em1, color: dir > 0 ? LIME : dir < 0 ? RED : 'transparent' };
      s.ema2Plot[i] = em2 == null || isNaN(em2) ? { time, value: NaN }
        : { time, value: em2, color: dir2 > 0 ? LIME : dir2 < 0 ? RED : 'transparent' };

      // ===== Hull MA =====
      // plot(not show_hma ? na : hullma(hma_src, hma_base_length + hma_length_scalar * 6))
      const hma = s.hma.step(hmaValue(b));
      s.hullMA[i] = { time, value: !showHma || hma == null ? NaN : hma };

      // ===== Signal 1: TEMA/DEMA buy/sell markers =====
      // vh1 = ema(highest(avg(low,close), fast), 5)
      // vl1 = ema(lowest(avg(high,close), slow), 8)
      const vh1 = s.vh1.step(s.vh1High.step((low + c) / 2, fastSignal));
      const vl1 = s.vl1.step(s.vl1Low.step((high + c) / 2, slowSignal));
      // TEMA: e1=ema(close,1), e2=ema(e1,1), e3=ema(e2,1), tema = 1*(e1-e2)+e3
      const e1 = s.e1.step(c);
      const e2 = s.e2.step(e1);
      const e3 = s.e3.step(e2);
      const tema = 1 * (e1 - e2) + e3;
      // DEMA: ee1=ema(close,8), ee2=ema(ee1,5), dema = 2*ee1 - ee2
      const ee1 = s.ee1.step(c);
      const ee2 = s.ee2.step(ee1);
      const dema = 2 * ee1 - ee2;
      // signal = tema > dema ? max(vh1, vl1) : min(vh1, vl1)
      const signal = tema > dema ? Math.max(vh1, vl1) : Math.min(vh1, vl1);
      s.signal[i] = signal;
      if (i >= 2) {
        const s1 = s.signal[i - 1];
        const s2 = s.signal[i - 2];
        // is_call = tema > dema and signal > low and (signal-signal[1] > signal[1]-signal[2])
        const isCall = tema > dema && signal > low && (signal - s1 > s1 - s2);
        // is_put = tema < dema and signal < high and (signal[1]-signal > signal[2]-signal[1])
        const isPut = tema < dema && signal < high && (s1 - signal > s2 - s1);
        if (isCall && dir > 0) {
          s.markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: GREEN, text: '*BUY*' });
        }
        if (isPut && dir < 0) {
          s.markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: RED, text: '*SELL*' });
        }
      }

      // ===== Signal 2: Supertrend arrows =====
      // Up=hl2-(Factor*atr(Pd)), Dn=hl2+(Factor*atr(Pd))
      // TrendUp=close[1]>TrendUp[1]? max(Up,TrendUp[1]) : Up
      // TrendDown=close[1]<TrendDown[1]? min(Dn,TrendDown[1]) : Dn
      // Trend = close > TrendDown[1] ? 1: close< TrendUp[1]? -1: nz(Trend[1],0)
      const atr = s.atr.step(high, low, c);
      const hl2 = (high + low) / 2;
      const upVal = hl2 - supertrendFactor * atr;
      const dnVal = hl2 + supertrendFactor * atr;
      const c1 = i > 0 ? s.close[i - 1] : NaN;
      const tu1 = i > 0 ? s.trendUp[i - 1] : NaN;
      const td1 = i > 0 ? s.trendDown[i - 1] : NaN;
      s.trendUp[i] = c1 > tu1 ? Math.max(upVal, tu1) : upVal;
      s.trendDown[i] = c1 < td1 ? Math.min(dnVal, td1) : dnVal;
      const trend = c > td1 ? 1 : c < tu1 ? -1 : (i > 0 ? s.trend[i - 1] : 0);
      s.trend[i] = trend;
      // plotarrow(Trend == 1 and Trend[1] == -1 ? Trend : na, "Up Entry Arrow", colorup = lime, transp = 85)
      // plotarrow(Trend == -1 and Trend[1] == 1 ? Trend : na, "Down Entry Arrow", colordown = red, transp = 85)
      if (i >= 1) {
        const prev = s.trend[i - 1];
        if (trend === 1 && prev === -1) s.arrows.push({ time, id: 'arrow0', value: trend, color: '#00FF0026' });
        if (trend === -1 && prev === 1) s.arrows.push({ time, id: 'arrow1', value: trend, color: '#FF000026' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'channelTop': s.channelTop.slice(),
          'channelBottom': s.channelBottom.slice(),
          'resistTop': s.resistTop.slice(),
          'resistBottom': s.resistBottom.slice(),
          'srTop': s.srTop.slice(),
          'srBottom': s.srBottom.slice(),
          'ema1': s.ema1Plot.slice(),
          'ema2': s.ema2Plot.slice(),
          'hullMA': s.hullMA.slice(),
        },
        fills: [
          // fill(ul2, ll2, color=black, transp=90) -- body channel
          { plot1: 'channelTop', plot2: 'channelBottom', options: { color: 'rgba(0,0,0,0.10)', title: 'Candle body resistance Channel' } },
          // fill(ul2, RT2, color=red, transp=75)
          { plot1: 'channelTop', plot2: 'srTop', options: { color: 'rgba(255,0,0,0.25)', title: 'Fill' } },
          // fill(ll2, RB2, color=green, transp=75)
          { plot1: 'channelBottom', plot2: 'srBottom', options: { color: 'rgba(0,128,0,0.25)', title: 'Fill' } },
        ],
        // markers in time order (pushed bar by bar)
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VdubSniperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VdubSniperInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VdubSniper = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
