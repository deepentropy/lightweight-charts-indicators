/**
 * Delta Flow Profile [LuxAlgo]
 *
 * Money flow profile of the last "Lookback Length" bars, drawn on the last bar. The price range of these bars is cut
 * into "Number of Rows" rows; each bar gives its money flow (volume times the row price) to the rows it touches, in
 * proportion to the part of its range inside the row.
 * - Money flow profile: one box per row to the right of the price, as long as the row flow against the largest row,
 *   with the amount and its share as text.
 * - Normalized profile: a column right of it, where each row is a bar from 0 to 100 % of the largest row.
 * - Delta profile: one box per row at the start of the range, for the difference between the flow of the bullish
 *   bars and the flow of the other bars (by the bar polarity or by the buying / selling pressure), in the colour of
 *   the dominant side. A vertical line at the start of the range takes the colour of the total delta.
 * - Level of significance: the row with the largest flow, as the path it followed bar after bar ("Developing"), as a
 *   line ("Level") or as a dotted line with a box ("Row"), with an arrow head next to the profile.
 * - Profile price levels: two labels with the high and the low of the range.
 *
 * These are the drawings of the last bar: they move when a bar is added. Nothing is drawn when the last bar has no
 * volume, or on a seconds chart.
 *
 * Chart values (third argument): the port reads the chart foreground and background colours (texts and the
 * normalized rows; without them #DBDBDB and #0F0F0F, a dark chart), the currency of the symbol (texts; "USD"
 * without it) and the symbol tick (price labels; 0.01 without it).
 *
 * Reference: "Delta Flow Profile [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { array, color, compare, math, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, PineSize, PolylineData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { backgroundColorOf, currencyOf, foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DeltaFlowProfileInputs {
  /** Money Flow Profile */
  showProfile: boolean;
  profileColor: string;
  /** Normalized profile */
  showNormalized: boolean;
  /** Delta Profile */
  showDelta: boolean;
  polarityMethod: 'Bar Polarity' | 'Bar Buying/Selling Pressure';
  bullishColor: string;
  bearishColor: string;
  /** Level of Significance */
  showLevel: boolean;
  levelMode: 'Developing' | 'Level' | 'Row';
  levelColor: string;
  /** Lookback Length / Fixed Range */
  lookback: number;
  rows: number;
  /** Profile width, in percent of the lookback */
  profileWidth: number;
  horizontalOffset: number;
  profileText: 'Auto' | 'Tiny' | 'Small' | 'None';
  /** Add the currency to the amounts */
  showCurrency: boolean;
  priceLevels: boolean;
  priceLevelsSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: DeltaFlowProfileInputs = {
  showProfile: true,
  profileColor: '#5288C4',
  showNormalized: true,
  showDelta: true,
  polarityMethod: 'Bar Polarity',
  bullishColor: '#5288C4',
  bearishColor: '#f7525f',
  showLevel: true,
  levelMode: 'Developing',
  levelColor: 'rgba(242, 54, 69, 0.75)',
  lookback: 360,
  rows: 25,
  profileWidth: 17,
  horizontalOffset: 13,
  profileText: 'Tiny',
  showCurrency: false,
  priceLevels: false,
  priceLevelsSize: 'Small',
};

const VP_GROUP = 'Calculation Settings';
const OT_GROUP = 'Display Settings';
const PROFILE_TIP = 'MONEY FLOW PROFILE:\n\nDisplays total money flow (both buying and selling) over a specified time period at specific price levels. '
  + 'Row lengths indicate the amount of money flow at specific price levels.\n\n'
  + 'NORMALIZED:\n\nThis profile normalizes the money flow data so that the length of each level is presented as a percentage of the maximum level length. This makes it easier to compare levels relative to the peak money flow.';

// The indented title starts with two em spaces (U+2003), as in the original
export const inputConfig: InputConfig[] = [
  { id: 'showProfile', type: 'bool', title: 'Money Flow Profile', defval: true, inline: 'mfp', group: VP_GROUP, tooltip: PROFILE_TIP },
  { id: 'profileColor', type: 'color', title: '', defval: '#5288C4', inline: 'mfp', group: VP_GROUP },
  { id: 'showNormalized', type: 'bool', title: 'Normalized ', defval: true, inline: 'mfp', group: VP_GROUP, tooltip: PROFILE_TIP },
  {
    id: 'showDelta', type: 'bool', title: 'Delta Profile', defval: true, group: VP_GROUP,
    tooltip: 'DELTA PROFILE:\n\nDisplays the delta and the dominant party over a specified time period at specific price levels.',
  },
  {
    id: 'polarityMethod', type: 'string', title: '  Polarity Method', defval: 'Bar Polarity',
    options: ['Bar Polarity', 'Bar Buying/Selling Pressure'], inline: 'pm', group: VP_GROUP,
    tooltip: 'POLARITY METHOD:\n\nConditions used to calculate the up/down money flow:\n\n'
      + '* Bar Polarity\n   up => if close > open\n   down => if close <= open\n\n'
      + '* Bar Buying/Selling Pressure\n   up => if (close - low) > (high - close)\n   down => if (close - low) <= (high - close)',
  },
  { id: 'bullishColor', type: 'color', title: '', defval: '#5288C4', inline: 'pm', group: VP_GROUP },
  { id: 'bearishColor', type: 'color', title: '', defval: '#f7525f', inline: 'pm', group: VP_GROUP },
  {
    id: 'showLevel', type: 'bool', title: 'Level of Significance', defval: true, inline: 'PoC', group: VP_GROUP,
    tooltip: 'Displays the price levels with the highest money flow or the changes in these price levels over a specified time period.',
  },
  { id: 'levelMode', type: 'string', title: '', defval: 'Developing', options: ['Developing', 'Level', 'Row'], inline: 'PoC', group: VP_GROUP },
  { id: 'levelColor', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.75)', inline: 'PoC', group: VP_GROUP },
  { id: 'lookback', type: 'int', title: 'Lookback Length / Fixed Range', defval: 360, min: 10, max: 1500, step: 10, group: VP_GROUP },
  { id: 'rows', type: 'int', title: 'Number of Rows', defval: 25, min: 10, max: 125, step: 5, group: VP_GROUP },
  { id: 'profileWidth', type: 'int', title: 'Profile Width %', defval: 17, min: 10, max: 50, group: OT_GROUP },
  { id: 'horizontalOffset', type: 'int', title: 'Profile Horizontal Offset', defval: 13, group: OT_GROUP },
  { id: 'profileText', type: 'string', title: 'Profile Text', defval: 'Tiny', options: ['Auto', 'Tiny', 'Small', 'None'], inline: 'txt', group: OT_GROUP },
  { id: 'showCurrency', type: 'bool', title: 'Currency', defval: false, inline: 'txt', group: OT_GROUP },
  { id: 'priceLevels', type: 'bool', title: 'Profile Price Levels', defval: false, inline: 'BBe', group: OT_GROUP },
  { id: 'priceLevelsSize', type: 'string', title: '', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], inline: 'BBe', group: OT_GROUP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Delta Flow Profile [LuxAlgo]',
  shortTitle: 'LuxAlgo - Delta Flow Profile',
  overlay: true,
};

/** indicator(max_boxes_count = 500): the original stops adding rows at 500 boxes */
const MAX_BOXES = 500;

const GRAY = '#787B86';
const BLUE = '#2962FF';
const YELLOW = '#FFEB3B';

/** f_gTxtSz(): any other value is size.auto */
const SIZES: Record<string, PineSize> = { Tiny: 'tiny', Small: 'small', Normal: 'normal' };
const textSize = (name: string): PineSize => SIZES[name] ?? 'auto';

/** A box with bar indexes */
interface BoxObj {
  left: number;
  top: number;
  right: number;
  bottom: number;
  border: string;
  bg: string;
  text?: string;
  textColor?: string;
  size?: PineSize;
  halign?: 'left' | 'right';
}
interface LineObj { x1: number; y1: number; x2: number; y2: number; color: string }
interface Point { x: number; y: number }

type Result = IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[]; labels: LabelData[]; polylines: PolylineData[] };

/** The drawings of the last bar, from the last bars */
function lastBarDrawings(bars: Bar[], inputs: Partial<DeltaFlowProfileInputs>, chart?: ChartContext): Result {
  // syminfo.mintick, syminfo.currency, chart.fg_color and chart.bg_color
  const MINTICK = mintickOf(chart);
  const CURRENCY = currencyOf(chart);
  const CHART_FG = foregroundColorOf(chart);
  const CHART_BG = backgroundColorOf(chart);
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const boxes: BoxData[] = [];
  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];
  const polylines: PolylineData[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    lines,
    labels,
    polylines,
  });
  if (n === 0) return result();

  // rpLN := last_bar_index > rpLN ? rpLN - 1 : last_bar_index
  const rpLN = last > cfg.lookback ? cfg.lookback - 1 : last;
  const rpNR = cfg.rows;
  const rpW = cfg.profileWidth / 100;
  const vpHO = cfg.horizontalOffset;
  const vpSH = cfg.showProfile;
  const npSH = cfg.showNormalized;
  const spSH = cfg.showDelta;
  const pcSH = cfg.showLevel;
  const rpPC = cfg.levelMode;
  const mfpC = cfg.profileColor;
  const vpHVC = cfg.levelColor;
  const withText = cfg.profileText !== 'None';
  const vpS = textSize(cfg.profileText);

  const nzV = (i: number) => bars[i].volume || 0; // nz(volume)
  const bull = (i: number) => {
    const b = bars[i];
    return cfg.polarityMethod === 'Bar Polarity' ? compare.gt(b.close, b.open) : compare.gt(b.close - b.low, b.high - b.close);
  };

  // Profile low / high: the bars from last_bar_index - rpLN
  const sI = last - rpLN;
  let pLST = NaN;
  let pHST = NaN;
  for (let i = sI; i <= last; i++) {
    pLST = i === sI ? bars[i].low : Math.min(bars[i].low, pLST);
    pHST = i === sI ? bars[i].high : Math.max(bars[i].high, pHST);
  }
  const pSTP = (pHST - pLST) / rpNR;

  // if barstate.islast and not na(nzV) and not timeframe.isseconds and rpLN > 0 and pSTP > 0 and nzV > 0
  const interval = barInterval(bars);
  const isSeconds = interval > 0 && (bars[0].time >= 1e12 ? interval / 1000 : interval) < 60;
  if (isSeconds || !(rpLN > 0) || !compare.gt(pSTP, 0) || !(nzV(last) > 0)) return result();

  const rpVST: number[] = new Array(rpNR).fill(0);
  const rpVSB: number[] = new Array(rpNR).fill(0);
  const rpVSD: number[] = new Array(rpNR).fill(0);
  const row = (l: number) => {
    if (!(l >= 0 && l < rpNR)) throw new Error(`Index ${l} is out of bounds, array size is ${rpNR}`);
    return l;
  };
  const pocRow = () => array.indexof(rpVST, array.max(rpVST));
  const pocPoints: Point[] = [];

  for (let bI = rpLN; bI >= 0; bI--) {
    const b = bars[last - bI];
    const volume = nzV(last - bI);
    let l = 0;
    // for pLL = pLST to pHST - pSTP by pSTP: the counter is compared as Pine compares floats
    for (let pLL = pLST; compare.le(pLL, pHST - pSTP); pLL += pSTP) {
      if (compare.ge(b.high, pLL) && compare.lt(b.low, pLL + pSTP)) {
        let vPOR: number;
        if (compare.ge(b.low, pLL) && compare.gt(b.high, pLL + pSTP)) vPOR = (pLL + pSTP - b.low) / (b.high - b.low);
        else if (compare.le(b.high, pLL + pSTP) && compare.lt(b.low, pLL)) vPOR = (b.high - pLL) / (b.high - b.low);
        else if (compare.ge(b.low, pLL) && compare.le(b.high, pLL + pSTP)) vPOR = 1;
        else vPOR = pSTP / (b.high - b.low);

        const amount = volume * vPOR * (pLST + (l + 0.5) * pSTP);
        rpVST[row(l)] += amount;
        if (bull(last - bI) && spSH) rpVSB[row(l)] += amount;
      }
      l += 1;
    }
    if (pcSH && rpPC === 'Developing') pocPoints.push({ x: last - bI, y: pLST + (pocRow() + 0.5) * pSTP });
  }

  const dRP: BoxObj[] = [];
  const dPR: LineObj[] = [];
  const NA = 'transparent';
  const third = Math.trunc((rpLN * rpW) / 3);
  const profileX = last + Math.trunc((4 * rpLN * rpW) / 3);
  const fmtVolume = (v: number) => str.tostring(v, 'volume');
  const fmtPct = (v: number) => str.tostring(v, '#.##');
  const vtMX = array.max(rpVST);
  const total = array.sum(rpVST);

  for (let l = 0; l < rpNR; l++) {
    const vtLV = rpVST[l];
    const LpM = vtLV / vtMX;
    const bbp = 2 * rpVSB[l] - vtLV;
    rpVSD[l] += bbp * (compare.gt(bbp, 0) ? 1 : -1);

    if (vpSH && npSH) {
      let sBI = profileX;
      dRP.push({
        left: sBI + 1 + vpHO, top: pLST + (l + 0.03) * pSTP, right: sBI + third + 3 + vpHO, bottom: pLST + (l + 0.97) * pSTP,
        border: NA, bg: String(color.from_gradient(LpM, 0, 1, color.new(mfpC, 93), color.new(mfpC, 53))),
      });
      dPR.push({ x1: sBI + 1 + vpHO, y1: pLST + (l + 0.0) * pSTP, x2: sBI + third + 3 + vpHO, y2: pLST + (l + 0.0) * pSTP, color: GRAY });
      if (l === rpNR - 1) {
        dPR.push({ x1: sBI + 1 + vpHO, y1: pLST + (l + 1.0) * pSTP, x2: sBI + third + 3 + vpHO, y2: pLST + (l + 1.0) * pSTP, color: GRAY });
      }
      sBI = sBI + third + 3 + vpHO;
      const eBI = sBI - Math.trunc(LpM * (third + 2));
      dRP.push({
        left: sBI, top: pLST + (l + 0.1) * pSTP, right: eBI, bottom: pLST + (l + 0.9) * pSTP,
        border: NA, bg: String(color.from_gradient(LpM, 0, 1, color.new(mfpC, 53), color.new(CHART_FG, 13))),
        text: withText ? str.tostring(LpM * 100, 'percent') : '',
        textColor: compare.eq(LpM, 1) ? BLUE : compare.gt(LpM, 0.5) ? CHART_BG : CHART_FG,
        halign: 'right', size: compare.eq(LpM, 1) ? 'small' : 'tiny',
      });
    }
  }

  if (spSH) {
    const bbp = 2 * array.sum(rpVSB) - total;
    dPR.push({ x1: sI, y1: pLST, x2: sI, y2: pHST, color: compare.gt(bbp, 0) ? cfg.bullishColor : cfg.bearishColor });
  }
  if (vpSH) {
    dPR.push({ x1: profileX + 1 + vpHO, y1: pLST, x2: profileX + 1 + vpHO, y2: pHST, color: mfpC });
    if (npSH) {
      const x = last + Math.trunc((5 * rpLN * rpW) / 3) + 3 + vpHO;
      dPR.push({ x1: x, y1: pLST, x2: x, y2: pHST, color: mfpC });
    }
  }

  const time = (x: number) => barTime(bars, x, interval);
  if (cfg.priceLevels) {
    const fmtTick = (v: number) => str.tostring(v, 'mintick', MINTICK);
    const totalText = 'Total Money Flow (' + CURRENCY + ') : ' + fmtVolume(total) + '\nNumber of bars : ' + str.tostring(rpLN + 1);
    const x = vpSH ? profileX + 1 + vpHO : last;
    const size = textSize(cfg.priceLevelsSize);
    labels.push({
      time: time(x), price: pHST, text: 'Profile High · ' + fmtTick(pHST), color: NA, style: 'label_down',
      textColor: mfpC, size, textAlign: 'left',
      tooltip: 'Profile High · ' + fmtTick(pHST) + '\n %' + fmtPct(((pHST - pLST) / pLST) * 100) + ' higher than the Profile Low\n\n' + totalText,
    });
    labels.push({
      time: time(x), price: pLST, text: 'Profile Low · ' + fmtTick(pLST), color: NA, style: 'label_up',
      textColor: mfpC, size, textAlign: 'left',
      tooltip: 'Profile Low · ' + fmtTick(pLST) + '\n %' + fmtPct(((pHST - pLST) / pHST) * 100) + ' lower than the Profile High\n\n' + totalText,
    });
  }

  const addPolyline = (lineStyle: 'solid' | 'dotted', lineWidth: number) => {
    polylines.push({
      points: pocPoints.map((p) => ({ time: time(p.x), price: p.y })), curved: false, closed: false, lineColor: vpHVC,
      fillColor: NA, lineStyle, lineWidth,
    });
  };

  const vdMX = array.max(rpVSD);
  const currency = cfg.showCurrency ? ' ' + CURRENCY : '';
  for (let l = 0; l < rpNR; l++) {
    if (dRP.length >= MAX_BOXES) continue;
    const vtLV = rpVST[l];
    const LpM = vtLV / vtMX;
    const DpM = rpVSD[l] / vdMX;
    const top = pLST + (l + 0.1) * pSTP;
    const bottom = pLST + (l + 0.9) * pSTP;

    if (vpSH) {
      const eBI = profileX - Math.trunc(LpM * rpLN * rpW);
      dRP.push({
        left: profileX + vpHO, top, right: eBI + vpHO, bottom, border: NA,
        bg: String(color.from_gradient(LpM, 0, 1, color.new(mfpC, 73), color.new(mfpC, 3))),
        text: withText ? fmtVolume(vtLV) + currency + ' (' + fmtPct(Math.abs((vtLV / total) * 100)) + '%)' : '',
        textColor: compare.eq(LpM, 1) ? YELLOW : CHART_FG, halign: 'right', size: vpS,
      });
    }

    if (spSH) {
      const eBI = sI + Math.trunc(DpM * rpLN * rpW);
      const bbp = 2 * rpVSB[l] - vtLV;
      const side = compare.gt(bbp, 0) ? cfg.bullishColor : cfg.bearishColor;
      dRP.push({
        left: sI + 1, top, right: eBI + 1, bottom, border: NA,
        bg: String(color.from_gradient(DpM, 0, 1, color.new(side, 80), color.new(side, 20))),
        text: withText ? fmtVolume(bbp) + currency : '', textColor: CHART_FG, halign: 'left', size: vpS,
      });
    }

    if (pcSH && compare.eq(LpM, 1)) {
      const eBI = vpSH ? last + math.round((rpLN * rpW) / 3) + vpHO : last;
      const poc = pocRow();
      const y = (part: number) => pLST + (poc + part) * pSTP;
      // An arrow head: tip, lower corner, tip, upper corner, tip
      const head = (tip: number, base: number) => {
        pocPoints.push({ x: tip, y: y(0.5) }, { x: base, y: y(0.2) }, { x: tip, y: y(0.5) }, { x: base, y: y(0.8) }, { x: tip, y: y(0.5) });
      };
      if (rpPC === 'Row' || rpPC === 'Level') {
        if (spSH) {
          const sBI = sI + Math.trunc(DpM * rpLN * rpW);
          head(sBI + 3, sBI + 1);
        } else {
          pocPoints.push({ x: last - rpLN, y: y(0.5) });
        }
      }
      if (vpSH) head(eBI - 2, eBI);
      else pocPoints.push({ x: eBI, y: y(0.5) });

      if (rpPC === 'Row' || rpPC === 'Level') addPolyline(rpPC === 'Level' ? 'solid' : 'dotted', rpPC === 'Level' ? 2 : 1);
      if (rpPC === 'Row') {
        const rowTop = array.indexof(rpVST, vtMX);
        dRP.push({
          left: spSH ? sI + Math.trunc(DpM * rpLN * rpW) + 1 : last - rpLN, top: pLST + (rowTop + 0.1) * pSTP, right: eBI,
          bottom: pLST + (rowTop + 0.9) * pSTP, border: vpHVC, bg: String(color.new(vpHVC, 73)),
        });
      }
    }
  }

  if (pcSH && rpPC === 'Developing') addPolyline('solid', 2);

  // An object with an na coordinate is not drawn
  for (const b of dRP) {
    if (isNaN(b.left) || isNaN(b.right) || isNaN(b.top) || isNaN(b.bottom)) continue;
    boxes.push({
      time1: time(b.left), price1: b.top, time2: time(b.right), price2: b.bottom, borderColor: b.border, bgColor: b.bg,
      ...(b.text !== undefined ? { text: b.text, textColor: b.textColor, textSize: b.size } : {}),
      ...(b.halign ? { textHAlign: b.halign } : {}),
    });
  }
  for (const l of dPR) {
    lines.push({ time1: time(l.x1), price1: l.y1, time2: time(l.x2), price2: l.y2, color: l.color, width: 2 });
  }
  return result();
}

// Nothing is calculated bar by bar: every output is a drawing of the last bar
type DeltaFlowProfileRun = BarRunState<Record<string, never>>;

function study(inputs: Partial<DeltaFlowProfileInputs>): BarStudy<DeltaFlowProfileRun, Result> {
  return {
    init: () => ({ steps: [], vars: {}, lists: [], series: [] }),
    bar() {},
    result: (_s, bars, chart) => lastBarDrawings(bars, inputs, chart),
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DeltaFlowProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeltaFlowProfileInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const DeltaFlowProfile = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
