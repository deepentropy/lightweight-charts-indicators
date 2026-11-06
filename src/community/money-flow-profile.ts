/**
 * Money Flow Profile [LuxAlgo]
 *
 * Volume (or money flow: volume times the row price) profile of the last "Lookback Length" bars, drawn on the last
 * bar to the right of the price. The price range of these bars is cut into "Number of Rows" rows; each bar gives
 * its volume to the rows it touches, in proportion to the part of its range inside the row.
 * - Volume / money flow profile: one box per row, coloured by the row volume against the largest row (high, average
 *   and low traded nodes), with the traded amount and its share as text.
 * - Sentiment profile: one box per row, to the left of the profile, for the difference between the volume of the
 *   bullish bars and the volume of the other bars (by the bar polarity or by the buying / selling pressure).
 * - A column of boxes with the row prices, the level of the largest row (a zone, a line or the developing level),
 *   and as options a heatmap, consolidation zones, the highest sentiment zone, the profile price labels and a
 *   background.
 *
 * These are the drawings of the last bar: they move when a bar is added. Nothing is drawn when the last bar has no
 * volume.
 * The port reads three values from the chart context (third argument): the price tick of the symbol for the price
 * texts (0.01 without it), the currency of the amounts ("USD" without it) and the chart foreground colour for the
 * text of the boxes (#DBDBDB, the colour of a dark chart, without it).
 *
 * Reference: "Money Flow Profile [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { array, color, compare, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, PineSize, PolylineData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { currencyOf, foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MoneyFlowProfileInputs {
  /** Lookback Length / Fixed Range */
  lookback: number;
  profileSource: 'Volume' | 'Money Flow';
  /** Volume/Money Flow Profile */
  showProfile: boolean;
  highNodesColor: string;
  /** High traded nodes threshold, in percent */
  highNodesThreshold: number;
  averageNodesColor: string;
  lowNodesColor: string;
  /** Low traded nodes threshold, in percent */
  lowNodesThreshold: number;
  showSentiment: boolean;
  polarityMethod: 'Bar Polarity' | 'Bar Buying/Selling Pressure';
  bullishNodesColor: string;
  bearishNodesColor: string;
  showHeatmap: boolean;
  heatmapSource: 'Volume/Money Flow Profile' | 'Sentiment Profile';
  heatmapTransparency: number;
  levelOfSignificance: 'Developing' | 'Last(Line)' | 'Last(Zone)' | 'None';
  consolidationZones: boolean;
  /** Consolidation threshold, in percent */
  consolidationThreshold: number;
  consolidationColor: string;
  highestSentimentZone: boolean;
  priceLevels: boolean;
  priceLevelsColor: string;
  priceLevelsSize: 'Tiny' | 'Small' | 'Normal';
  background: boolean;
  backgroundColor: string;
  rows: number;
  /** Profile width, in percent of the lookback */
  profileWidth: number;
  profileTextSize: 'Auto' | 'Tiny' | 'Small';
  horizontalOffset: number;
}

export const defaultInputs: MoneyFlowProfileInputs = {
  lookback: 200,
  profileSource: 'Volume',
  showProfile: true,
  highNodesColor: 'rgba(255,235,59,0.5)',
  highNodesThreshold: 53,
  averageNodesColor: 'rgba(41,98,255,0.5)',
  lowNodesColor: 'rgba(242,54,69,0.5)',
  lowNodesThreshold: 37,
  showSentiment: true,
  polarityMethod: 'Bar Polarity',
  bullishNodesColor: 'rgba(38,166,154,0.5)',
  bearishNodesColor: 'rgba(239,83,80,0.5)',
  showHeatmap: false,
  heatmapSource: 'Volume/Money Flow Profile',
  heatmapTransparency: 73,
  levelOfSignificance: 'Last(Zone)',
  consolidationZones: false,
  consolidationThreshold: 25,
  consolidationColor: 'rgba(41,98,255,0.27)',
  highestSentimentZone: false,
  priceLevels: false,
  priceLevelsColor: '#00bcd4',
  priceLevelsSize: 'Small',
  background: false,
  backgroundColor: 'rgba(0,188,212,0.05)',
  rows: 25,
  profileWidth: 13,
  profileTextSize: 'Auto',
  horizontalOffset: 13,
};

const RP_GROUP = 'Profile Generic Settings';
const VP_GROUP = 'Profile Presentation Settings';
const OTH_GROUP = 'Other Presentation Settings';
const OT_GROUP = 'Other Profile Settings';
const HM_SOURCE_PROFILE = 'Volume/Money Flow Profile';

// The indented titles start with two em spaces (U+2003), as in the original
export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: '  Lookback Length / Fixed Range', defval: 200, min: 10, max: 1500, step: 10, group: RP_GROUP },
  { id: 'profileSource', type: 'string', title: '  Profile Source', defval: 'Volume', options: ['Volume', 'Money Flow'], group: RP_GROUP },
  {
    id: 'showProfile', type: 'bool', title: 'Volume/Money Flow Profile', defval: true, group: VP_GROUP,
    tooltip: 'displays total trading activity/money flow (common interest, both buying and selling trading activity/money flow) over a specified time period at specific price levels\n\n'
      + ' - high traded node rows : high trading activity/money flow price levels - usually represents consolidation levels (value areas)\n'
      + ' - average traded node rows : average trading activity/money flow price levels\n'
      + ' - low traded node rows : low trading activity/money flow price levels - usually represents supply & demand levels or liquidity levels\n\n'
      + 'row lengths, indicates the amount of the traded activity/money flow at specific price levels',
  },
  { id: 'highNodesColor', type: 'color', title: '  High Traded Nodes', defval: 'rgba(255,235,59,0.5)', inline: 'VP1', group: VP_GROUP },
  {
    id: 'highNodesThreshold', type: 'int', title: 'Threshold %', defval: 53, min: 50, max: 99, step: 1, inline: 'VP1', group: VP_GROUP,
    tooltip: 'option range [50-99]',
  },
  { id: 'averageNodesColor', type: 'color', title: '  Average Traded Nodes', defval: 'rgba(41,98,255,0.5)', group: VP_GROUP },
  { id: 'lowNodesColor', type: 'color', title: '  Low Traded Nodes', defval: 'rgba(242,54,69,0.5)', inline: 'VP2', group: VP_GROUP },
  {
    id: 'lowNodesThreshold', type: 'int', title: 'Threshold %', defval: 37, min: 10, max: 40, step: 1, inline: 'VP2', group: VP_GROUP,
    tooltip: 'option range [10-40]',
  },
  {
    id: 'showSentiment', type: 'bool', title: 'Sentiment Profile', defval: true, group: VP_GROUP,
    tooltip: 'displays the sentiment, the dominat party over a specified time period at the specific price levels\n\n'
      + ' - bullish node rows : buying trading activity/money flow is higher\n'
      + ' - barish node rows : selling trading activity/money flow is higher\n\n'
      + 'row lengths, indicates the strength of the buyers/sellers at the specific price levels',
  },
  {
    id: 'polarityMethod', type: 'string', title: '  Sentiment Polarity Method', defval: 'Bar Polarity',
    options: ['Bar Polarity', 'Bar Buying/Selling Pressure'], group: VP_GROUP,
    tooltip: 'conditions used to calculate the up/down volume/money flow\n\n'
      + '* bar polarity\n   up => if close > open\n   down => if close <= open\n\n'
      + '* bar buying/selling pressure\n   up => if (close - low) > (high - close)\n   down => if (close - low) <= (high - close)',
  },
  { id: 'bullishNodesColor', type: 'color', title: '  Bullish Nodes', defval: 'rgba(38,166,154,0.5)', inline: 'SP', group: VP_GROUP },
  { id: 'bearishNodesColor', type: 'color', title: 'Bearish Nodes', defval: 'rgba(239,83,80,0.5)', inline: 'SP', group: VP_GROUP },
  {
    id: 'showHeatmap', type: 'bool', title: 'Profile Heatmap', defval: false, group: VP_GROUP,
    tooltip: 'tip : higher number of rows results with a better visuals',
  },
  {
    id: 'heatmapSource', type: 'string', title: '  Heatmap Source', defval: HM_SOURCE_PROFILE,
    options: [HM_SOURCE_PROFILE, 'Sentiment Profile'], group: VP_GROUP,
  },
  { id: 'heatmapTransparency', type: 'int', title: '  Heatmap Transparency', defval: 73, min: 0, max: 100, group: VP_GROUP },
  {
    id: 'levelOfSignificance', type: 'string', title: '  Level of Significance', defval: 'Last(Zone)',
    options: ['Developing', 'Last(Line)', 'Last(Zone)', 'None'], inline: 'PoC', group: OTH_GROUP,
    tooltip: 'displays the price level of the highest traded activity/money flow or the changes of the price levels with the highest traded activity/money flow',
  },
  { id: 'consolidationZones', type: 'bool', title: 'Consolidation Zones', defval: false, group: OTH_GROUP },
  { id: 'consolidationThreshold', type: 'int', title: '  Consolidation Threshold %', defval: 25, min: 0, max: 100, inline: 'va', group: OTH_GROUP },
  { id: 'consolidationColor', type: 'color', title: '', defval: 'rgba(41,98,255,0.27)', inline: 'va', group: OTH_GROUP },
  {
    id: 'highestSentimentZone', type: 'bool', title: 'Highest Sentiment Zone', defval: false, inline: 'spP', group: OTH_GROUP,
    tooltip: 'displays the price zone of the highest bullish or bearish sentiment zone',
  },
  { id: 'priceLevels', type: 'bool', title: 'Profile Price Levels', defval: false, inline: 'BBe', group: OTH_GROUP },
  { id: 'priceLevelsColor', type: 'color', title: '', defval: '#00bcd4', inline: 'BBe', group: OTH_GROUP },
  { id: 'priceLevelsSize', type: 'string', title: '', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], inline: 'BBe', group: OTH_GROUP },
  { id: 'background', type: 'bool', title: 'Profile Range Background Fill', defval: false, inline: 'BG', group: OTH_GROUP },
  { id: 'backgroundColor', type: 'color', title: '', defval: 'rgba(0,188,212,0.05)', inline: 'BG', group: OTH_GROUP },
  {
    id: 'rows', type: 'int', title: '  Number of Rows', defval: 25, min: 10, max: 100, step: 5, group: OT_GROUP,
    tooltip: 'option range [10-100]',
  },
  {
    id: 'profileWidth', type: 'int', title: '  Profile Width %', defval: 13, min: 10, max: 50, group: OT_GROUP,
    tooltip: 'option range [10-50]',
  },
  { id: 'profileTextSize', type: 'string', title: '  Profile Text Size', defval: 'Auto', options: ['Auto', 'Tiny', 'Small'], group: OT_GROUP },
  {
    id: 'horizontalOffset', type: 'int', title: '  Profile Horizontal Offset', defval: 13, group: OT_GROUP,
    tooltip: 'option allows negative numbers as well, in case of a use the profiles will overlap with the price chart',
  },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Money Flow Profile [LuxAlgo]',
  shortTitle: 'LuxAlgo - Money Flow Profile',
  overlay: true,
};

/** indicator(max_boxes_count = 500): the original stops adding rows at 500 boxes */
const MAX_BOXES = 500;

/** A box with bar indexes (left / right can have a fraction: the bar is the integer part) */
interface BoxObj {
  left: number;
  top: number;
  right: number;
  bottom: number;
  border: string;
  bg: string;
  text?: string;
  halign?: 'left' | 'right';
}

const SIZES: Record<string, PineSize> = { Tiny: 'tiny', Small: 'small', Normal: 'normal', Auto: 'auto' };

type Result = IndicatorResult & { boxes: BoxData[]; labels: LabelData[]; polylines: PolylineData[] };

/** The drawings of the last bar, from the bars of the lookback (built again on each update: they move with a new bar) */
function lastBarDrawings(bars: Bar[], inputs: Partial<MoneyFlowProfileInputs>, chart?: ChartContext): Result {
  // syminfo.mintick, syminfo.currency and chart.fg_color (text of the boxes)
  const MINTICK = mintickOf(chart);
  const CURRENCY = currencyOf(chart);
  const CHART_FG = foregroundColorOf(chart);
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const boxes: BoxData[] = [];
  const labels: LabelData[] = [];
  const polylines: PolylineData[] = [];
  const result = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    labels,
    polylines,
  });
  if (n === 0) return result();

  // rpLN := last_bar_index > rpLN ? rpLN - 1 : last_bar_index
  const rpLN = last > cfg.lookback ? cfg.lookback - 1 : last;
  const rpNR = cfg.rows;
  const rpW = cfg.profileWidth / 100;
  const vpHO = cfg.horizontalOffset;
  const vpHVT = cfg.highNodesThreshold / 100;
  const vpLVT = cfg.lowNodesThreshold / 100;
  const vaTH = cfg.consolidationThreshold / 100;
  const hmTR = cfg.heatmapTransparency;
  const moneyFlow = cfg.profileSource === 'Money Flow';
  const vpSH = cfg.showProfile;
  const spSH = cfg.showSentiment;
  const rpPC = cfg.levelOfSignificance;
  const vpS = SIZES[cfg.profileTextSize];

  const nzV = (i: number) => bars[i].volume || 0; // nz(volume)
  const bull = (i: number) => {
    const b = bars[i];
    return cfg.polarityMethod === 'Bar Polarity' ? compare.gt(b.close, b.open) : compare.gt(b.close - b.low, b.high - b.close);
  };

  // Profile low / high: the bars from last_bar_index - rpLN
  let pLST = NaN;
  let pHST = NaN;
  for (let i = last - rpLN; i <= last; i++) {
    pLST = i === last - rpLN ? bars[i].low : Math.min(bars[i].low, pLST);
    pHST = i === last - rpLN ? bars[i].high : Math.max(bars[i].high, pHST);
  }
  const pSTP = (pHST - pLST) / rpNR;

  // if barstate.islast and not timeframe.isseconds and rpLN > 0 and pSTP > 0 and nzV > 0
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
  const pocPrice = () => pLST + (array.indexof(rpVST, array.max(rpVST)) + 0.5) * pSTP;
  const pocPoints: Array<{ x: number; y: number }> = [];

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

        const amount = moneyFlow ? volume * vPOR * (pLST + (l + 0.5) * pSTP) : volume * vPOR;
        rpVST[row(l)] += amount;
        if (bull(last - bI) && spSH) rpVSB[row(l)] += amount;
      }
      l += 1;
    }
    if (rpPC === 'Developing') pocPoints.push({ x: last - bI, y: pocPrice() });
  }

  const time = (x: number) => barTime(bars, Math.trunc(x), interval);
  const addPolyline = (points: Array<{ x: number; y: number }>, lineColor: string, lineStyle: 'solid' | 'dotted', lineWidth: number) => {
    polylines.push({
      points: points.map((p) => ({ time: time(p.x), price: p.y })), curved: false, closed: false, lineColor,
      lineStyle, lineWidth,
    });
  };

  if (rpPC === 'Developing') addPolyline(pocPoints, cfg.highNodesColor, 'solid', 2);
  if (rpPC === 'Last(Zone)' || rpPC === 'Last(Line)') {
    pocPoints.push({ x: last - rpLN, y: pocPrice() }, { x: last, y: pocPrice() });
    addPolyline(pocPoints, cfg.highNodesColor, rpPC === 'Last(Line)' ? 'solid' : 'dotted', rpPC === 'Last(Line)' ? 2 : 1);
  }

  const dRP: BoxObj[] = [];
  const fmtTick = (v: number) => str.tostring(v, 'mintick', MINTICK);
  const fmtVolume = (v: number) => str.tostring(v, 'volume');
  const fmtPct = (v: number) => str.tostring(v, '#.##');
  const third = Math.trunc((rpLN * rpW) / 3);

  for (let l = 0; l < rpNR; l++) {
    const bbp = 2 * rpVSB[l] - rpVST[l];
    rpVSD[l] += bbp * (compare.gt(bbp, 0) ? 1 : -1);

    if (vpSH || spSH) {
      const sBI = last + (spSH ? rpLN * rpW : 7) + third;
      dRP.push({
        left: sBI - 1 + vpHO, top: pLST + (l + 0.1) * pSTP, right: sBI - third + 1 + vpHO, bottom: pLST + (l + 0.9) * pSTP,
        border: '#2962ff80', bg: '#2962ff10', text: fmtTick(pLST + (l + 0.5) * pSTP),
      });
    }
  }

  if (cfg.background) {
    dRP.push({ left: last - rpLN, top: pLST, right: last, bottom: pHST, border: cfg.backgroundColor, bg: cfg.backgroundColor });
  }

  const total = array.sum(rpVST);
  if (cfg.priceLevels) {
    const totalText = 'Total ' + (cfg.profileSource === 'Volume' ? 'Volume : ' : 'Money Flow (' + CURRENCY + ') : ') + fmtVolume(total)
      + '\nNumber of bars : ' + str.tostring(rpLN + 1);
    const size = SIZES[cfg.priceLevelsSize];
    labels.push({
      time: time(last), price: pHST, text: fmtTick(pHST), color: 'transparent', style: 'label_down',
      textColor: cfg.priceLevelsColor, size, textAlign: 'left',
      tooltip: 'Profile High - ' + fmtTick(pHST) + '\n %' + fmtPct(((pHST - pLST) / pLST) * 100) + ' higher than the Profile Low\n\n' + totalText,
    });
    labels.push({
      time: time(last), price: pLST, text: fmtTick(pLST), color: 'transparent', style: 'label_up',
      textColor: cfg.priceLevelsColor, size, textAlign: 'left',
      tooltip: 'Profile Low - ' + fmtTick(pLST) + '\n %' + fmtPct(((pHST - pLST) / pHST) * 100) + ' lower than the Profile High\n\n' + totalText,
    });
  }

  const vtMX = array.max(rpVST);
  const vdMX = array.max(rpVSD);
  const heatAlpha = Math.trunc(hmTR / 4);
  for (let l = 0; l < rpNR; l++) {
    if (dRP.length >= MAX_BOXES) continue;
    const vtLV = rpVST[l];
    const LpM = vtLV / vtMX;
    const DpM = rpVSD[l] / vdMX;
    const rowLow = pLST + (l + 0.0) * pSTP;
    const rowHigh = pLST + (l + 1.0) * pSTP;

    const llC = String(compare.gt(LpM, vpHVT)
      ? color.from_gradient(LpM, vpHVT, 1, cfg.averageNodesColor, cfg.highNodesColor)
      : color.from_gradient(LpM, 0, vpLVT, cfg.lowNodesColor, cfg.averageNodesColor));
    const bbp = 2 * rpVSB[l] - vtLV;
    const side = compare.gt(bbp, 0) ? cfg.bullishNodesColor : cfg.bearishNodesColor;
    const lsC = String(color.from_gradient(DpM, 0, 0.7, color.new(side, 70 + heatAlpha), color.new(side, 30 + heatAlpha)));

    if (rpPC === 'Last(Zone)' && compare.eq(LpM, 1)) {
      const poc = array.indexof(rpVST, vtMX);
      dRP.push({
        left: last - rpLN, top: pLST + (poc + 0.0) * pSTP, right: last, bottom: pLST + (poc + 1.0) * pSTP,
        border: cfg.highNodesColor, bg: String(color.new(cfg.highNodesColor, 73)),
      });
    }
    if (cfg.consolidationZones && compare.gt(LpM, vaTH) && compare.lt(LpM, 1)) {
      dRP.push({ left: last - rpLN, top: rowLow, right: last, bottom: rowHigh, border: 'transparent', bg: cfg.consolidationColor });
    }
    if (cfg.consolidationZones && rpPC !== 'Last(Zone)' && compare.eq(LpM, 1)) {
      dRP.push({ left: last - rpLN, top: rowLow, right: last, bottom: rowHigh, border: 'transparent', bg: cfg.consolidationColor });
    }
    if (cfg.highestSentimentZone && compare.eq(DpM, 1)) {
      const top = array.indexof(rpVSD, vdMX);
      addPolyline([{ x: last - rpLN, y: pLST + (top + 0.5) * pSTP }, { x: last, y: pLST + (top + 0.5) * pSTP }], lsC, 'dotted', 1);
      dRP.push({
        left: last - rpLN, top: pLST + (top + 0.0) * pSTP, right: last, bottom: pLST + (top + 1.0) * pSTP,
        border: lsC, bg: String(color.new(lsC, 73)),
      });
    }
    if (vpSH) {
      const sBI = last + (spSH ? rpLN * rpW : 7) + third;
      const eBI = sBI + Math.trunc(LpM * rpLN * rpW);
      dRP.push({
        left: sBI + vpHO, top: pLST + (l + 0.1) * pSTP, right: eBI + vpHO, bottom: pLST + (l + 0.9) * pSTP, border: llC, bg: llC,
        text: fmtVolume(moneyFlow ? vtLV : vtLV * (pLST + (l + 0.5) * pSTP)) + ' ' + CURRENCY
          + ' (' + fmtPct(Math.abs((vtLV / total) * 100)) + '%)',
        halign: 'left',
      });
    }
    if (spSH) {
      const sBI = last + rpLN * rpW;
      const eBI = sBI - Math.trunc(DpM * rpLN * rpW);
      dRP.push({
        left: sBI + vpHO, top: pLST + (l + 0.1) * pSTP, right: eBI + vpHO, bottom: pLST + (l + 0.9) * pSTP, border: lsC, bg: lsC,
        text: fmtVolume(bbp) + (moneyFlow ? ' ' + CURRENCY : '') + ' (' + fmtPct(Math.abs((bbp / vtLV) * 100)) + '%)',
        halign: 'right',
      });
    }
    if (cfg.showHeatmap) {
      const c = cfg.heatmapSource === HM_SOURCE_PROFILE ? String(color.new(llC, hmTR)) : lsC;
      dRP.push({ left: last - rpLN, top: rowLow, right: last, bottom: rowHigh, border: c, bg: c });
    }
  }

  for (const b of dRP) {
    boxes.push({
      time1: time(b.left), price1: b.top, time2: time(b.right), price2: b.bottom, borderColor: b.border, bgColor: b.bg,
      ...(b.text !== undefined ? { text: b.text, textColor: CHART_FG, textSize: vpS } : {}),
      ...(b.halign ? { textHAlign: b.halign } : {}),
    });
  }
  return result();
}

// Nothing is calculated bar by bar: every output is a drawing of the last bar
type MoneyFlowProfileRun = BarRunState<Record<string, never>>;

function study(inputs: Partial<MoneyFlowProfileInputs>): BarStudy<MoneyFlowProfileRun, Result> {
  return {
    init: () => ({ steps: [], vars: {}, lists: [], series: [] }),
    bar() {},
    result: (_s, bars, chart) => lastBarDrawings(bars, inputs, chart),
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MoneyFlowProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MoneyFlowProfileInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MoneyFlowProfile = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
