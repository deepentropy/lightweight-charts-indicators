/**
 * Boom Hunter Pro
 *
 * Three Ehlers Even Better Sinewave / Roofing Filter oscillators (EOT1, EOT2, EOT3)
 * with different periods. Uses Ehlers Highpass filter (100-bar) into SuperSmoother,
 * then Fast Attack / Slow Decay normalization. Quotient transform with K parameters.
 * LSMA WaveTrend using linreg for additional confluence.
 * Entry signals from crossover conditions on quotient + trigger.
 *
 * Reference: TradingView "Boom Hunter Pro" by veryfid
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BoomHunterProInputs {
  lpPeriod: number;
  k1: number;
  trigLen: number;
  lpPeriod2: number;
  k12: number;
  k22: number;
  lpPeriod3: number;
  k13: number;
  square: boolean;
  showLongs: boolean;
  showShorts: boolean;
}

export const defaultInputs: BoomHunterProInputs = {
  lpPeriod: 6,
  k1: 0,
  trigLen: 2,
  lpPeriod2: 27,
  k12: 0.8,
  k22: 0.3,
  lpPeriod3: 11,
  k13: 0.99,
  square: true,
  showLongs: true,
  showShorts: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lpPeriod', type: 'int', title: 'EOT1 LPPeriod', defval: 6, min: 1 },
  { id: 'k1', type: 'float', title: 'EOT1 K1', defval: 0, step: 0.1 },
  { id: 'trigLen', type: 'int', title: 'Trigger Length', defval: 2, min: 1 },
  { id: 'lpPeriod2', type: 'int', title: 'EOT2 LPPeriod', defval: 27, min: 1 },
  { id: 'k12', type: 'float', title: 'EOT2 K1', defval: 0.8, step: 0.1 },
  { id: 'k22', type: 'float', title: 'EOT2 K2', defval: 0.3, step: 0.1 },
  { id: 'lpPeriod3', type: 'int', title: 'EOT3 LPPeriod', defval: 11, min: 1 },
  { id: 'k13', type: 'float', title: 'EOT3 K1', defval: 0.99, step: 0.01 },
  { id: 'square', type: 'bool', title: 'Square Line', defval: true },
  { id: 'showLongs', type: 'bool', title: 'Show Long Entries', defval: true },
  { id: 'showShorts', type: 'bool', title: 'Show Short Entries', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Quotient1', color: '#0000FF', lineWidth: 2 },
  { id: 'plot1', title: 'Trigger', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot2', title: 'Q3 (Red Wave)', color: '#FF000080', lineWidth: 1 },
  { id: 'plot3', title: 'Q5 (Yellow)', color: '#FFFF00', lineWidth: 1 },
  { id: 'plot4', title: 'Q6 (Blue Boom)', color: '#0000FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Boom Hunter Pro',
  shortTitle: 'Boom Pro',
  overlay: false,
};

/**
 * Ehlers Highpass + SuperSmoother + Fast Attack/Slow Decay + Quotient transform.
 * Returns two quotient arrays for K1 and K2 parameters.
 */
function ehlers_eot(
  closeArr: number[],
  n: number,
  lpPeriod: number,
  paramK1: number,
  paramK2: number,
  hpDivisor: number = 2,
): { q1: number[]; q2: number[] } {
  const pi = Math.PI;

  // Highpass filter: period=100
  const alpha1 = (Math.cos(0.707 * 2 * pi / 100) + Math.sin(0.707 * 2 * pi / 100) - 1) / Math.cos(0.707 * 2 * pi / 100);

  const HP: number[] = new Array(n).fill(0);
  for (let i = 2; i < n; i++) {
    HP[i] = (1 - alpha1 / hpDivisor) * (1 - alpha1 / 2) * (closeArr[i] - 2 * closeArr[i - 1] + closeArr[i - 2])
      + 2 * (1 - alpha1) * HP[i - 1]
      - (1 - alpha1) * (1 - alpha1) * HP[i - 2];
  }

  // SuperSmoother
  const a1 = Math.exp(-1.414 * pi / lpPeriod);
  const b1 = 2 * a1 * Math.cos(1.414 * pi / lpPeriod);
  const c2 = b1;
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;

  const Filt: number[] = new Array(n).fill(0);
  for (let i = 2; i < n; i++) {
    Filt[i] = c1 * (HP[i] + HP[i - 1]) / 2 + c2 * Filt[i - 1] + c3 * Filt[i - 2];
  }

  // Fast Attack / Slow Decay
  const Peak: number[] = new Array(n).fill(0);
  const X: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    Peak[i] = 0.991 * Peak[i - 1];
    if (Math.abs(Filt[i]) > Peak[i]) Peak[i] = Math.abs(Filt[i]);
    if (Peak[i] !== 0) X[i] = Filt[i] / Peak[i];
  }

  // Quotient transform
  const q1: number[] = new Array(n).fill(0);
  const q2: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const denom1 = paramK1 * X[i] + 1;
    q1[i] = denom1 !== 0 ? (X[i] + paramK1) / denom1 : 0;
    const denom2 = paramK2 * X[i] + 1;
    q2[i] = denom2 !== 0 ? (X[i] + paramK2) / denom2 : 0;
  }

  return { q1, q2 };
}

export function calculate(bars: Bar[], inputs: Partial<BoomHunterProInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { lpPeriod, k1, trigLen, lpPeriod2, k12, k22, lpPeriod3, k13, square, showLongs, showShorts } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeArr = bars.map(b => b.close);
  const K2 = 0.3;
  const esize = 60;
  const ey = 50;

  // EOT3: K13/K33 with square option
  let finalK13 = k13;
  let k33 = -k13;
  if (square) {
    finalK13 = 0.9999;
    k33 = -0.9999;
  }

  // EOT 1: main oscillator (hp divisor = 2)
  const eot1 = ehlers_eot(closeArr, n, lpPeriod, k1, K2, 2);

  // EOT 2: red wave (hp divisor = 2)
  const eot2 = ehlers_eot(closeArr, n, lpPeriod2, k12, k22, 2);

  // EOT 3: yellow line (hp divisor = 3 per Pine source line 170: (1-alpha/3)*(1-alpha/2))
  const eot3 = ehlers_eot(closeArr, n, lpPeriod3, finalK13, k33, 3);

  // Scale to chart: q * esize + ey
  const q1Arr = eot1.q1.map(v => v * esize + ey);
  const q2Arr = eot1.q2.map(v => v * esize + ey);
  const q3Arr = eot2.q1.map(v => v * esize + ey);
  const q4Arr = eot2.q2.map(v => v * esize + ey);
  const q5Arr = eot3.q1.map(v => v * esize + ey);
  const q6Arr = eot3.q2.map(v => v * esize + ey);

  // Trigger = SMA(q1, trigLen)
  const q1Series = Series.fromArray(bars, q1Arr);
  const triggerArr = ta.sma(q1Series, trigLen).toArray();

  // Track crossover state for coloring
  const crossState: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const t = triggerArr[i] ?? 0;
    const prevQ1 = q1Arr[i - 1];
    const curQ1 = q1Arr[i];
    const prevT = triggerArr[i - 1] ?? 0;
    if (prevQ1 <= prevT && curQ1 > t) crossState[i] = 1;
    else if (prevQ1 >= prevT && curQ1 < t) crossState[i] = 0;
    else crossState[i] = crossState[i - 1];
  }

  // Drag counter: consecutive bars with Quotient1 <= -1
  const drag: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    if (eot1.q1[i] <= -1) {
      drag[i] = drag[i - 1] + 1;
    } else if (eot1.q1[i - 1] <= -0.9 && eot1.q1[i] > -0.9) {
      drag[i] = 0;
    } else {
      drag[i] = drag[i - 1];
    }
  }

  const dragNo = 3;
  const warmup = 5;

  // LSMA WaveTrend (simplified): linreg of close RSI for long-term reference
  // Pine uses a tradition() function with tci/mf/rsi averaged; we approximate with linreg of q1
  const lsmaArr = ta.linreg(q1Series, 200, 0).toArray();

  // Plot 0: q1 colored by state
  const plot0 = q1Arr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    let color: string;
    if (crossState[i] === 1) color = '#00FFAA';
    else if (drag[i] >= dragNo) color = '#800080';
    else if (eot1.q1[i] <= -0.8) color = '#FFFF00';
    else if (eot2.q1[i] <= -0.9) color = '#FFFFFF';
    else if (crossState[i] === 0) color = '#FF0000';
    else color = '#808080';
    return { time: bars[i].time, value: v, color };
  });

  // Plot 1: trigger line
  const plot1 = triggerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  // Plot 2: q3 (red wave EOT2)
  const plot2 = q3Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // Plot 3: q5 (yellow EOT3)
  const plot3 = q5Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // Plot 4: q6 (blue boom line EOT3)
  const plot4 = q6Arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // Entry markers
  const markers: MarkerData[] = [];
  for (let i = 2; i < n; i++) {
    if (i < warmup) continue;
    const q1v = q1Arr[i];
    const prevQ1 = q1Arr[i - 1];
    const trig = triggerArr[i] ?? 0;
    const prevTrig = triggerArr[i - 1] ?? 0;
    const crossoverQ1Trig = prevQ1 <= prevTrig && q1v > trig;
    const crossunderQ1Trig = prevQ1 >= prevTrig && q1v < trig;

    // Long signals
    if (showLongs) {
      // enter7: Quotient3 <= -0.9 and crossover(q1, trigger) -- Yellow long
      if (eot2.q1[i] <= -0.9 && crossoverQ1Trig) {
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'labelDown',
          color: '#FFFF00CC',
          text: 'Long',
        });
      }
      // enter5: barssince(q1<=0 and crossunder) <= 5 and crossover -- Blue long
      else if (crossoverQ1Trig) {
        let bsSince = n;
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const pq = q1Arr[j];
          const ppq = j > 0 ? q1Arr[j - 1] : 0;
          const pt = triggerArr[j] ?? 0;
          const ppt = j > 0 ? (triggerArr[j - 1] ?? 0) : 0;
          if (pq <= 0 && ppq >= ppt && pq < pt) {
            bsSince = i - j;
            break;
          }
        }
        if (bsSince <= 5) {
          markers.push({
            time: bars[i].time,
            position: 'aboveBar',
            shape: 'labelDown',
            color: '#0000FFCC',
            text: 'Long',
          });
        }
        // enter6: barssince(q1<=20 and crossunder) <= 11 and crossover and q1<=60 -- Gray long
        else if (q1v <= 60) {
          let bsSince2 = n;
          for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
            const pq = q1Arr[j];
            const ppq = j > 0 ? q1Arr[j - 1] : 0;
            const pt = triggerArr[j] ?? 0;
            const ppt = j > 0 ? (triggerArr[j - 1] ?? 0) : 0;
            if (pq <= 20 && ppq >= ppt && pq < pt) {
              bsSince2 = i - j;
              break;
            }
          }
          if (bsSince2 <= 11) {
            markers.push({
              time: bars[i].time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#C0C0C0CC',
              text: 'Long',
            });
          }
        }
      }
    }

    // Short signals
    if (showShorts) {
      // senter3: Quotient3 >= -0.9 and crossunder(q1, trigger) and barssince(warn3)<=7 and q1>=99
      const warn3 = eot1.q1[i - 1] >= 0.9 && eot1.q1[i] < 0.9; // crossunder(Q1, 0.9)
      if (eot2.q1[i] >= -0.9 && crossunderQ1Trig && q1v >= 99) {
        let bsWarn3 = n;
        for (let j = i; j >= Math.max(0, i - 8); j--) {
          if (j > 0 && eot1.q1[j - 1] >= 0.9 && eot1.q1[j] < 0.9) {
            bsWarn3 = i - j;
            break;
          }
        }
        if (bsWarn3 <= 7) {
          markers.push({
            time: bars[i].time,
            position: 'aboveBar',
            shape: 'labelDown',
            color: '#FF0000CC',
            text: 'Short',
          });
        }
      }
    }

    // Overbought warnings: cross(Q5, Q6) with Q5>0.5
    const prevQ5 = eot3.q1[i - 1];
    const curQ5 = eot3.q1[i];
    const prevQ6 = eot3.q2[i - 1];
    const curQ6 = eot3.q2[i];
    const crossQ5Q6 = (prevQ5 <= prevQ6 && curQ5 > curQ6) || (prevQ5 >= prevQ6 && curQ5 < curQ6);
    if (crossQ5Q6 && curQ5 > 0.5) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'circle',
        color: '#FFA500',
        text: 'OB',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    hlines: [],
    markers,
  };
}

export const BoomHunterPro = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
