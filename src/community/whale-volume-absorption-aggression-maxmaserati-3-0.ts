/**
 * Whale Volume Absorption & Aggression
 *
 * Volume columns coloured by the bar direction (close < open: seller, else buyer) and by the volume tier against the
 * SMA of the volume: retail (below mid * SMA), mid-tier (>= mid * SMA), whale (>= whale * SMA) and ultra / climax
 * (>= ultra * SMA). The SMA of the volume is drawn as a line; whale and ultra bars also colour the background.
 *
 * Reference: "Whale Volume Absorption & Aggression @MaxMaserati 3.0" by MaxMaserati
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WhaleVolumeAbsorptionAggressionInputs {
  volMaLength: number;
  midMult: number;
  whaleMult: number;
  ultraMult: number;
  colSellRetail: string;
  colSellMid: string;
  colSellWhale: string;
  colSellUltra: string;
  colBuyRetail: string;
  colBuyMid: string;
  colBuyWhale: string;
  colBuyUltra: string;
}

// Input colour defaults: color.new(c, 70) is alpha 0.3, color.new(c, 30) alpha 0.7 (input alpha bytes 77 / 179)
export const defaultInputs: WhaleVolumeAbsorptionAggressionInputs = {
  volMaLength: 20,
  midMult: 0.8,
  whaleMult: 2.0,
  ultraMult: 3.0,
  colSellRetail: 'rgba(255, 152, 0, 0.3)',
  colSellMid: 'rgba(244, 67, 54, 0.7)',
  colSellWhale: '#b71c1c',
  colSellUltra: '#4a148c',
  colBuyRetail: 'rgba(129, 199, 132, 0.3)',
  colBuyMid: 'rgba(76, 175, 80, 0.7)',
  colBuyWhale: '#1b5e20',
  colBuyUltra: '#00bcd4',
};

export const inputConfig: InputConfig[] = [
  { id: 'volMaLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 1, group: 'Volume Thresholds' },
  { id: 'midMult', type: 'float', title: 'Mid-Tier Multiplier', defval: 0.8, step: 0.1, group: 'Volume Thresholds' },
  { id: 'whaleMult', type: 'float', title: 'Whale Multiplier', defval: 2.0, step: 0.1, group: 'Volume Thresholds' },
  { id: 'ultraMult', type: 'float', title: 'Climax / HFT Multiplier', defval: 3.0, step: 0.1, group: 'Volume Thresholds' },
  { id: 'colSellRetail', type: 'color', title: 'Retail Seller (Low)', defval: 'rgba(255, 152, 0, 0.3)', group: 'Volume Colors' },
  { id: 'colSellMid', type: 'color', title: 'Mid-Tier Seller (Avg)', defval: 'rgba(244, 67, 54, 0.7)', group: 'Volume Colors' },
  { id: 'colSellWhale', type: 'color', title: 'Whale Seller (High)', defval: '#b71c1c', group: 'Volume Colors' },
  { id: 'colSellUltra', type: 'color', title: 'Ultra Seller Climax', defval: '#4a148c', group: 'Volume Colors' },
  { id: 'colBuyRetail', type: 'color', title: 'Retail Buyer (Low)', defval: 'rgba(129, 199, 132, 0.3)', group: 'Volume Colors' },
  { id: 'colBuyMid', type: 'color', title: 'Mid-Tier Buyer (Avg)', defval: 'rgba(76, 175, 80, 0.7)', group: 'Volume Colors' },
  { id: 'colBuyWhale', type: 'color', title: 'Whale Buyer (High)', defval: '#1b5e20', group: 'Volume Colors' },
  { id: 'colBuyUltra', type: 'color', title: 'Ultra Buyer Climax', defval: '#00bcd4', group: 'Volume Colors' },
];

const AVG_COL = String(color.new(color.gray, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume Average', color: AVG_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Whale Volume Absorption & Aggression @MaxMaserati 3.0',
  shortTitle: 'Whale Volume @MaxMaserati 3.0',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons with 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface WhaleRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: { time: number; value: number; color?: string }[];
  plot1: { time: number; value: number; color: string }[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<WhaleVolumeAbsorptionAggressionInputs>): BarStudy<WhaleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgSellWhale = String(color.new(cfg.colSellWhale, 90));
  const bgSellUltra = String(color.new(cfg.colSellUltra, 85));
  const bgBuyWhale = String(color.new(cfg.colBuyWhale, 90));
  const bgBuyUltra = String(color.new(cfg.colBuyUltra, 85));
  return {
    init() {
      const sma = new WindowSma(cfg.volMaLength);
      const st: WhaleRun = { sma, plot0: [], plot1: [], bgColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      st.lists = [st.bgColors];
      st.series = [st.plot0, st.plot1];
      return st;
    },
    bar(st, i, bars) {
      const b = bars[i];
      const v = b.volume ?? NaN;
      const s = st.sma.step(v);
      const isSeller = lt(b.close, b.open);
      const isBuyer = ge(b.close, b.open);
      const isUltra = ge(v, s * cfg.ultraMult);
      const isWhale = ge(v, s * cfg.whaleMult) && !isUltra;
      const isMid = ge(v, s * cfg.midMult) && !isWhale && !isUltra;

      // color volColor = na; if isSeller ... else if isBuyer ...
      let volColor: string | undefined;
      if (isSeller) {
        volColor = isUltra ? cfg.colSellUltra : isWhale ? cfg.colSellWhale : isMid ? cfg.colSellMid : cfg.colSellRetail;
      } else if (isBuyer) {
        volColor = isUltra ? cfg.colBuyUltra : isWhale ? cfg.colBuyWhale : isMid ? cfg.colBuyMid : cfg.colBuyRetail;
      }
      st.plot0[i] = volColor === undefined ? { time: b.time, value: v } : { time: b.time, value: v, color: volColor };
      st.plot1[i] = { time: b.time, value: s, color: AVG_COL };

      // Four bgcolor calls in this order (at most one is not na on a bar)
      if (isSeller && isWhale) st.bgColors.push({ id: 'bgcolor0', time: b.time, color: bgSellWhale });
      if (isSeller && isUltra) st.bgColors.push({ id: 'bgcolor1', time: b.time, color: bgSellUltra });
      if (isBuyer && isWhale) st.bgColors.push({ id: 'bgcolor2', time: b.time, color: bgBuyWhale });
      if (isBuyer && isUltra) st.bgColors.push({ id: 'bgcolor3', time: b.time, color: bgBuyUltra });
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: st.plot0.slice(), plot1: st.plot1.slice() },
        markers: [],
        bgColors: st.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WhaleVolumeAbsorptionAggressionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<WhaleVolumeAbsorptionAggressionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const WhaleVolumeAbsorptionAggression = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
