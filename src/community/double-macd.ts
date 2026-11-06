/**
 * Double MACD Buy and Sell
 *
 * Two MACD instances (12/26 and 5/15) each plotted as both line AND histogram.
 * Divergence detection on MACD2 with fractal tops/bottoms.
 * Entry markers (largo/corto) on MACD2 zero cross with MACD1 confirmation.
 * Counter-trend entries (largo1/corto1) on MACD2/MACD1 cross.
 * Alerts (alertcondition, `alerts` of the result): 'Compras' (largo or largo1), 'Ventas' (corto or corto1) and
 * 'Compras/Ventas' (any of them), with both entry kinds on as the port draws them.
 *
 * Reference: "DOBLE MACD X" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DoubleMACDInputs {
  fast1: number;
  slow1: number;
  sig1: number;
  fast2: number;
  slow2: number;
  sig2: number;
  src: SourceType;
}

export const defaultInputs: DoubleMACDInputs = {
  fast1: 12,
  slow1: 26,
  sig1: 9,
  fast2: 5,
  slow2: 15,
  sig2: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fast1', type: 'int', title: 'MACD1 Fast', defval: 12, min: 1 },
  { id: 'slow1', type: 'int', title: 'MACD1 Slow', defval: 26, min: 1 },
  { id: 'sig1', type: 'int', title: 'MACD1 Signal', defval: 9, min: 1 },
  { id: 'fast2', type: 'int', title: 'MACD2 Fast', defval: 5, min: 1 },
  { id: 'slow2', type: 'int', title: 'MACD2 Slow', defval: 15, min: 1 },
  { id: 'sig2', type: 'int', title: 'MACD2 Signal', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'macd1Line', title: 'MACD 1226 Line', color: '#C0C0C0', lineWidth: 2 },
  { id: 'macd1Hist', title: 'MACD 1226 Hist', color: '#C0C0C0', lineWidth: 2, style: 'histogram' },
  { id: 'macd2Line', title: 'MACD 515 Line', color: '#FFFF00', lineWidth: 2 },
  { id: 'macd2Hist', title: 'MACD 515 Hist', color: '#FFFF00', lineWidth: 2, style: 'histogram' },
  { id: 'divBear', title: 'Bearish Div', color: '#FF0000', lineWidth: 1 },
  { id: 'divBull', title: 'Bullish Div', color: '#0AAC00', lineWidth: 1 },
];

export const metadata = {
  title: 'Double MACD',
  shortTitle: 'DMACD',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface DoubleMacdVars {
  /** Track last fractal values for divergence comparison (simplified valuewhen) */
  highPrev: number;
  highPrice: number;
  lowPrev: number;
  lowPrice: number;
}

interface DoubleMacdRun extends BarRunState<DoubleMacdVars> {
  emas: Ema[];
  macd1: number[];
  macd2: number[];
  dbbEma: number[];
  plots: Point[][];
  divBear: Point[];
  divBull: Point[];
  /** The divergence labels of every bar, then the entry markers of every bar (the order of the original port) */
  divMarkers: MarkerData[];
  entryMarkers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DoubleMACDInputs>): BarStudy<DoubleMacdRun, Result> {
  const { fast1, slow1, fast2, slow2, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup1 = slow1;
  const warmup2 = slow2;
  const warmup = Math.max(warmup1, warmup2);
  // Pine bgcolor: atlas zone (red bg when dbb < factor) and choppiness zone (red bg when chop > 50)
  // Atlas + choppiness detection
  const bbLen = 20;
  const bbMult = 2.0;
  const chopLen = 14;
  const chopLevel = 50;
  // EMA of dbb with period 120 (Pine: dbbmed = ema(dbb, 120), factor = dbbmed*4/5)
  const emaLen = 120;
  const emaMult = 2 / (emaLen + 1);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const emas = [taStep.ema(fast1), taStep.ema(slow1), taStep.ema(fast2), taStep.ema(slow2)];
      const s: DoubleMacdRun = {
        emas, macd1: [], macd2: [], dbbEma: [], plots: [[], [], [], []], divBear: [], divBull: [], divMarkers: [],
        entryMarkers: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: emas, vars: { highPrev: NaN, highPrice: NaN, lowPrev: NaN, lowPrice: NaN }, lists: [], series: [],
      };
      s.lists = [...s.times, s.divMarkers, s.entryMarkers, s.bgColors];
      s.series = [s.macd1, s.macd2, s.dbbEma, ...s.plots, s.divBear, s.divBull, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const x = value(b);
      // MACD 1 (12/26) and MACD 2 (5/15) - Pine plots as both line and histogram
      const m1 = s.emas[0].step(x) - s.emas[1].step(x);
      const m2 = s.emas[2].step(x) - s.emas[3].step(x);
      const macd1Arr = s.macd1;
      const macd2Arr = s.macd2;
      macd1Arr[i] = m1;
      macd2Arr[i] = m2;
      // MACD1 line + histogram (gray #C0C0C0), MACD2 line + histogram (yellow #FFFF00)
      s.plots[0][i] = { time, value: (i < warmup1 || m1 == null) ? NaN : m1 };
      s.plots[1][i] = { time, value: (i < warmup1 || m1 == null) ? NaN : m1 };
      s.plots[2][i] = { time, value: (i < warmup2 || m2 == null) ? NaN : m2 };
      s.plots[3][i] = { time, value: (i < warmup2 || m2 == null) ? NaN : m2 };

      // Divergence detection on MACD2 using fractals
      // f_top_fractal(src) => src[4]<src[2] and src[3]<src[2] and src[2]>src[1] and src[2]>src[0]
      // f_bot_fractal(src) => src[4]>src[2] and src[3]>src[2] and src[2]<src[1] and src[2]<src[0]
      let fractalTop: number | null = null;
      let fractalBot: number | null = null;
      if (i >= 4) {
        const s0 = macd2Arr[i] ?? NaN, s1 = macd2Arr[i - 1] ?? NaN;
        const s2 = macd2Arr[i - 2] ?? NaN, s3 = macd2Arr[i - 3] ?? NaN, s4 = macd2Arr[i - 4] ?? NaN;
        if (s4 < s2 && s3 < s2 && s2 > s1 && s2 > s0) fractalTop = s2;
        if (s4 > s2 && s3 > s2 && s2 < s1 && s2 < s0) fractalBot = s2;
      }

      if (fractalTop != null) {
        const curVal = fractalTop;
        const curPrice = bars[i - 2] ? bars[i - 2].high : b.high;
        const regBearish = !isNaN(v.highPrev) && curPrice > v.highPrice && curVal < v.highPrev;
        const hidBearish = !isNaN(v.highPrev) && curPrice < v.highPrice && curVal > v.highPrev;
        const col = regBearish || hidBearish ? '#FF0000' : 'transparent';
        // Pine: plot with offset=-2, so place at i-2
        s.divBear[i] = { time: bars[i - 2] ? bars[i - 2].time : time, value: curVal, color: col };

        // Pine plotshape: regular bearish = Bear R, hidden bearish = Bear O
        // Pine offset=-2, so place label at bar i-2
        const labelTime = bars[i - 2] ? bars[i - 2].time : time;
        if (regBearish) {
          s.divMarkers.push({ id: 'shape0', time: labelTime, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Bear R' });
        }
        if (hidBearish) {
          s.divMarkers.push({ id: 'shape1', time: labelTime, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Bear O' });
        }

        v.highPrev = curVal;
        v.highPrice = curPrice;
      } else {
        s.divBear[i] = { time, value: NaN };
      }

      if (fractalBot != null) {
        const curVal = fractalBot;
        const curPrice = bars[i - 2] ? bars[i - 2].low : b.low;
        const regBullish = !isNaN(v.lowPrev) && curPrice < v.lowPrice && curVal > v.lowPrev;
        const hidBullish = !isNaN(v.lowPrev) && curPrice > v.lowPrice && curVal < v.lowPrev;
        const col = regBullish || hidBullish ? '#0AAC00' : 'transparent';
        // Pine: plot with offset=-2, so place at i-2
        s.divBull[i] = { time: bars[i - 2] ? bars[i - 2].time : time, value: curVal, color: col };

        // Pine plotshape: regular bullish = Bull R, hidden bullish = Bull O
        // Pine offset=-2, so place label at bar i-2
        const labelTime = bars[i - 2] ? bars[i - 2].time : time;
        if (regBullish) {
          s.divMarkers.push({ id: 'shape2', time: labelTime, position: 'belowBar', shape: 'labelUp', color: '#0AAC00', text: 'Bull R' });
        }
        if (hidBullish) {
          s.divMarkers.push({ id: 'shape3', time: labelTime, position: 'belowBar', shape: 'labelUp', color: '#0AAC00', text: 'Bull O' });
        }

        v.lowPrev = curVal;
        v.lowPrice = curPrice;
      } else {
        s.divBull[i] = { time, value: NaN };
      }

      // Entry signals
      // Pine: largo = crossover(macd_2,0) and macd_1 < macd_2 and macd_1[1] < macd_1[0] and macd_1 < 0
      // Pine: largo1 = crossover(macd_2,macd_1) and macd_2 < 0
      // Pine: corto = crossunder(macd_2,0) and macd_1 > macd_2 and macd_1[1] > macd_1[0] and macd_1 > 0
      // Pine: corto1 = crossunder(macd_2,macd_1) and macd_2 > 0
      if (i >= warmup + 1) {
        const m2prev = macd2Arr[i - 1];
        const m1prev = macd1Arr[i - 1] ?? NaN;
        if (!(m2 == null || m2prev == null || m1 == null || isNaN(m1prev))) {
          // Trend buy: macd2 crosses above 0, macd1 < macd2, macd1 rising, macd1 < 0
          if (m2prev <= 0 && m2 > 0 && m1 < m2 && m1 > m1prev && m1 < 0) {
            s.entryMarkers.push({ id: 'shape4', time, position: 'belowBar', shape: 'triangleUp', color: '#0AAC00', text: 'Buy' });
          }
          // Trend sell: macd2 crosses below 0, macd1 > macd2, macd1 falling, macd1 > 0
          if (m2prev >= 0 && m2 < 0 && m1 > m2 && m1 < m1prev && m1 > 0) {
            s.entryMarkers.push({ id: 'shape6', time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'Sell' });
          }

          // Counter-trend buy: macd2 crosses above macd1, macd2 < 0
          const m1prev2 = macd1Arr[i - 1] ?? NaN;
          if (m2prev <= m1prev2 && m2 > m1 && m2 < 0) {
            s.entryMarkers.push({ id: 'shape5', time, position: 'belowBar', shape: 'triangleUp', color: '#0AAC00', text: 'CT Buy' });
          }
          // Counter-trend sell: macd2 crosses below macd1, macd2 > 0
          if (m2prev >= m1prev2 && m2 < m1 && m2 > 0) {
            s.entryMarkers.push({ id: 'shape7', time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'CT Sell' });
          }
        }
      }

      // Alerts: largo / largo1 / corto / corto1 on every bar where the two MACDs and their previous values exist (the
      // port has no "Ver Señal" inputs and draws both entry kinds: vset and vsct are on)
      let largoF = false;
      let cortoF = false;
      if (i >= 1) {
        const m2a = macd2Arr[i] ?? NaN, m2p = macd2Arr[i - 1] ?? NaN;
        const m1a = macd1Arr[i] ?? NaN, m1p = macd1Arr[i - 1] ?? NaN;
        // largo = crossover(macd_2, 0) and macd_1 < macd_2 and macd_1[1] < macd_1[0] and macd_1 < 0
        const largo = m2a > 0 && m2p <= 0 && m1a < m2a && m1p < m1a && m1a < 0;
        // largo1 = crossover(macd_2, macd_1) and macd_2 < 0
        const largo1 = m2a > m1a && m2p <= m1p && m2a < 0;
        // corto = crossunder(macd_2, 0) and macd_1 > macd_2 and macd_1[1] > macd_1[0] and macd_1 > 0
        const corto = m2a < 0 && m2p >= 0 && m1a > m2a && m1p > m1a && m1a > 0;
        // corto1 = crossunder(macd_2, macd_1) and macd_2 > 0
        const corto1 = m2a < m1a && m2p >= m1p && m2a > 0;
        largoF = largo || largo1;
        cortoF = corto || corto1;
      }
      // alertcondition(largo or largo1) / (corto or corto1) / (largo or largo1 or corto or corto1)
      const flags = [largoF, cortoF, largoF || cortoF];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      // dbb (0 before bbLen bars) and its EMA (seeded with the first dbb)
      let dbb = 0;
      if (i >= bbLen - 1) {
        let sumSrc = 0, sumSq = 0;
        for (let j = i - bbLen + 1; j <= i; j++) {
          sumSrc += bars[j].close;
          sumSq += bars[j].close * bars[j].close;
        }
        const mean = sumSrc / bbLen;
        const stdv = Math.sqrt(Math.max(0, sumSq / bbLen - mean * mean));
        const bbUp = mean + bbMult * stdv;
        const bbLo = mean - bbMult * stdv;
        dbb = bbUp > 0 ? Math.sqrt((bbUp - bbLo) / bbUp) * 20 : 0;
      }
      let dbbEma = 0;
      if (i === bbLen - 1) dbbEma = dbb;
      else if (i > bbLen - 1) dbbEma = dbb * emaMult + s.dbbEma[i - 1] * (1 - emaMult);
      s.dbbEma[i] = dbbEma;

      if (i >= Math.max(warmup, bbLen, chopLen)) {
        // Atlas: atl = dbb - factor, all = atl > 0 ? 0 : 1
        const factor = dbbEma * 4 / 5;
        const atl = dbb - factor;
        const atlZone = atl <= 0;

        // Choppiness: 100 * log10(sum(tr, len) / (highest - lowest)) / log10(len)
        let sumTr = 0, hh = -Infinity, ll = Infinity;
        for (let j = i - chopLen + 1; j <= i; j++) {
          const tr = Math.max(bars[j].high - bars[j].low,
            j > 0 ? Math.abs(bars[j].high - bars[j - 1].close) : 0,
            j > 0 ? Math.abs(bars[j].low - bars[j - 1].close) : 0);
          sumTr += tr;
          const cmpL = j > 0 ? Math.min(bars[j].low, bars[j - 1].close) : bars[j].low;
          const cmpH = j > 0 ? Math.max(bars[j].high, bars[j - 1].close) : bars[j].high;
          if (cmpH > hh) hh = cmpH;
          if (cmpL < ll) ll = cmpL;
        }
        const height = hh - ll;
        const chop = height > 0 ? 100 * Math.log10(sumTr / height) / Math.log10(chopLen) : 0;
        const chopZone = chop >= chopLevel;

        if (atlZone || chopZone) {
          s.bgColors.push({ time, color: 'rgba(255, 0, 0, 0.1)' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'macd1Line': s.plots[0].slice(),
          'macd1Hist': s.plots[1].slice(),
          'macd2Line': s.plots[2].slice(),
          'macd2Hist': s.plots[3].slice(),
          'divBear': s.divBear.slice(),
          'divBull': s.divBull.slice(),
        },
        hlines: [
          { value: 0, options: { color: '#000000', linestyle: 'solid' as const, title: 'Zero' } },
        ],
        markers: [...s.divMarkers, ...s.entryMarkers],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DoubleMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DoubleMACDInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message given: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Compras', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Ventas', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Compras/Ventas', message: 'Alert Fired!' },
];

export const DoubleMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
