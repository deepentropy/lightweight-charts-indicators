/**
 * Order Flow Imbalance Oscillator
 *
 * Supply zones start after three bearish candles with one of them above the average volume (last 1,000 bars):
 * the zone goes from the low of the last bullish candle within 5 bars up by 2 * ATR(200), with a delta equal to the
 * signed volume of the candles after it. Demand zones are the mirror (from the high of the last bearish candle down
 * by 2 * ATR(200)). After a zone, the next one of the same side needs 14 bars. A close above a supply zone top (below
 * a demand zone bottom) removes the zone; overlapping zones are removed and at most 5 zones of each side are kept.
 * The oscillator is (demand - supply) / (demand + supply) * 100, with demand / supply the sums of the absolute zone
 * deltas, drawn as an area in the demand colour at or above 0 and in the supply colour below 0.
 *
 * Reference: "Order Flow Imbalance Oscillator [StrikePriceLabs]" by StrikePriceLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © StrikePriceLabs
 */

import { taStep, array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OrderFlowImbalanceOscillatorInputs {
  /** Supply colour */
  colSupply: string;
  /** Demand colour */
  colDemand: string;
}

export const defaultInputs: OrderFlowImbalanceOscillatorInputs = {
  colSupply: color.orange,
  colDemand: '#009fd4',
};

export const inputConfig: InputConfig[] = [
  { id: 'colSupply', type: 'color', title: 'Supply', defval: color.orange },
  { id: 'colDemand', type: 'color', title: 'Demand', defval: '#009fd4' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Order Flow Imbalance (-100 to +100)', color: '#009fd4', lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'Order Flow Imbalance Oscillator [StrikePriceLabs]',
  shortTitle: 'Order Flow Imbalance Oscillator [StrikePriceLabs]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color: string };

interface OfioVars {
  /** The last 1000 volumes */
  vol: number[];
  bearTop: number[];
  bearBot: number[];
  bearDelta: number[];
  bullTop: number[];
  bullBot: number[];
  bullDelta: number[];
  countBear: number;
  countBull: number;
}

interface OfioRun extends BarRunState<OfioVars> {
  atr: ReturnType<typeof taStep.atr>;
  volume: number[];
  bear: boolean[];
  bull: boolean[];
  extraVol: boolean[];
  plot0: Point[];
}

function study(inputs: Partial<OrderFlowImbalanceOscillatorInputs>): BarStudy<OfioRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(200);
      const s: OfioRun = {
        atr, volume: [], bear: [], bull: [], extraVol: [], plot0: [],
        steps: [atr],
        vars: {
          vol: array.new_float(0), bearTop: [], bearBot: [], bearDelta: [], bullTop: [], bullBot: [], bullDelta: [],
          countBear: 0, countBull: 0,
        },
        lists: [], series: [],
      };
      s.series = [s.volume, s.bear, s.bull, s.extraVol, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const bi = bars[i];
      const atr = s.atr.step(bi.high, bi.low, bi.close) * 2;
      const { volume, bear, bull, extraVol } = s;
      volume[i] = bi.volume === undefined || bi.volume === null ? NaN : bi.volume;
      bear[i] = lt(bi.close, bi.open);
      bull[i] = gt(bi.close, bi.open);
      // History reads: a bar before the first bar is na (false for the booleans)
      const bearAt = (i: number, k: number) => (i - k >= 0 ? bear[i - k] : false);
      const bullAt = (i: number, k: number) => (i - k >= 0 ? bull[i - k] : false);
      const volAt = (i: number, k: number) => (i - k >= 0 ? volume[i - k] : NaN);
      const extraAt = (i: number, k: number) => (i - k >= 0 ? extraVol[i - k] : false);
      // changed in place: copyVars copies them at the end of the last confirmed bar
      const v = s.vars;
      const { vol, bearTop, bearBot, bearDelta, bullTop, bullBot, bullDelta } = v;
      let { countBear, countBull } = v;
      const b = bars[i];
      array.push(vol, volume[i]);
      if (array.size(vol) > 1000) array.shift(vol);
      extraVol[i] = gt(volume[i], array.avg(vol));
      const anyExtra = extraAt(i, 0) || extraAt(i, 1) || extraAt(i, 2);

      // Bearish zones (supply)
      if (bear[i] && bearAt(i, 1) && bearAt(i, 2) && anyExtra && countBear === 0) {
        let delta = 0.0;
        for (let k = 0; k <= 5; k++) {
          if (bullAt(i, k)) {
            countBear = 1;
            bearTop.push(bars[i - k].low + atr);
            bearBot.push(bars[i - k].low);
            bearDelta.push(delta);
            break;
          }
          delta += bearAt(i, k) ? -volAt(i, k) : volAt(i, k);
        }
      }
      if (countBear >= 1) countBear += 1;
      if (countBear >= 15) countBear = 0;

      // Bullish zones (demand)
      if (bull[i] && bullAt(i, 1) && bullAt(i, 2) && anyExtra && countBull === 0) {
        let delta = 0.0;
        for (let k = 0; k <= 5; k++) {
          if (bearAt(i, k)) {
            countBull = 1;
            bullTop.push(bars[i - k].high);
            bullBot.push(bars[i - k].high - atr);
            bullDelta.push(delta);
            break;
          }
          delta += bullAt(i, k) ? volAt(i, k) : -volAt(i, k);
        }
      }
      if (countBull >= 1) countBull += 1;
      if (countBull >= 15) countBull = 0;

      // Supply invalidation
      for (let s = 0; s < bearTop.length;) {
        if (gt(b.close, bearTop[s])) {
          bearTop.splice(s, 1);
          bearBot.splice(s, 1);
          bearDelta.splice(s, 1);
        } else s += 1;
      }
      // Demand invalidation
      for (let d = 0; d < bullTop.length;) {
        if (lt(b.close, bullBot[d])) {
          bullTop.splice(d, 1);
          bullBot.splice(d, 1);
          bullDelta.splice(d, 1);
        } else d += 1;
      }

      // Overlapping supply zones: zone i is removed when another zone top is inside it
      if (bearTop.length > 0) {
        let z = 0;
        while (z < bearTop.length) {
          const top = bearTop[z];
          const bot = bearBot[z];
          let removed = false;
          for (let j = 0; j < bearTop.length; j++) {
            if (z !== j && lt(bearTop[j], top) && gt(bearTop[j], bot)) {
              bearTop.splice(z, 1);
              bearBot.splice(z, 1);
              bearDelta.splice(z, 1);
              removed = true;
              break;
            }
          }
          if (!removed) z += 1;
        }
        while (bearTop.length > 5) {
          bearTop.shift();
          bearBot.shift();
          bearDelta.shift();
        }
      }
      // Overlapping demand zones: zone i is removed when another zone bottom is inside it
      if (bullTop.length > 0) {
        let z = 0;
        while (z < bullTop.length) {
          const top = bullTop[z];
          const bot = bullBot[z];
          let removed = false;
          for (let j = 0; j < bullTop.length; j++) {
            if (z !== j && lt(bullBot[j], top) && gt(bullBot[j], bot)) {
              bullTop.splice(z, 1);
              bullBot.splice(z, 1);
              bullDelta.splice(z, 1);
              removed = true;
              break;
            }
          }
          if (!removed) z += 1;
        }
        while (bullTop.length > 5) {
          bullTop.shift();
          bullBot.shift();
          bullDelta.shift();
        }
      }

      // Historical totals (the Pine log.info calls give no output)
      let supplySum = 0.0;
      for (const dl of bearDelta) supplySum += Math.abs(dl);
      let demandSum = 0.0;
      for (const dl of bullDelta) demandSum += Math.abs(dl);

      const denom = demandSum + supplySum;
      v.countBear = countBear;
      v.countBull = countBull;
      const out = ne(denom, 0) ? ((demandSum - supplySum) / denom) * 100 : 0;
      s.plot0[i] = { time: b.time, value: out, color: ge(out, 0) ? cfg.colDemand : cfg.colSupply };
    },
    copyVars: (v) => ({
      vol: v.vol.slice(), bearTop: v.bearTop.slice(), bearBot: v.bearBot.slice(), bearDelta: v.bearDelta.slice(),
      bullTop: v.bullTop.slice(), bullBot: v.bullBot.slice(), bullDelta: v.bullDelta.slice(),
      countBear: v.countBear, countBull: v.countBull,
    }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 0, options: { title: 'Balance', color: String(color.new(color.gray, 70)), linestyle: 'dashed' } },
          { value: 50, options: { title: '+50 Strong Demand', color: String(color.new(cfg.colDemand, 50)), linestyle: 'dashed' } },
          { value: -50, options: { title: '-50 Strong Supply', color: String(color.new(cfg.colSupply, 50)), linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OrderFlowImbalanceOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OrderFlowImbalanceOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const OrderFlowImbalanceOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
