/**
 * Volume Analysis - Heatmap and Volume Profile
 *
 * Splits each of the last chart bars into a grid of boxes (Number of Columns in time x Number of Rows in price) built
 * from the bars of a lower timeframe of the chart symbol (intrabars): each column is a slice of the bar's time, each
 * row a slice of the intrabar close range. Every intrabar adds its volume to the box of its close; its sign is the
 * move of its close from the close before (from its open when it differs from the close; a zero move keeps the sign
 * before). The box colour shows the volume of the box against the largest volume of its sign (Colors), empty boxes
 * are grey, the box of the last intrabar close has a stronger border. Under each grid: the buy and sell volume of each
 * column (cumulative and difference options), a line through the column closes (Closing Price), on the last bar a
 * volume profile of the intrabar closes of all grids with its value area (Value Area Volume percent of the volume), the
 * POC line in the pane and on the price chart, a bracket on the price chart that marks the analysed bars, and an info
 * panel. The number of grids is what 500 boxes allow (9 with the defaults); "Location of Candles" draws the grids at
 * their price or from zero.
 *
 * Lower timeframe (as the original): "Lower Tier" plan: chart seconds / 1000 in whole minutes, at least 1 minute
 * (1 minute up to the 1-day chart); "Premium or Higher": seconds timeframes (1, 5, 10, 15, 30 seconds) below the
 * 1-day chart. The port asks for these bars with `requiredSymbols` (the chart symbol on that timeframe; on charts
 * above 1 day also its daily bars, used to close the gaps between sessions) and reads them from the chart context
 * (`bars` accessor, `symbolBarsOf`); without them it throws a MissingSymbolDataError. A chart timeframe of 1 minute or
 * less ("Lower Tier") or of less than 30 seconds ("Premium or Higher") draws the message label of the original.
 *
 * The original keeps its arrays with `varip` (they also hold the realtime updates of the last bar); the port
 * calculates the bars once, as on a chart load. The chart type is taken as standard candles (`chart.is_standard`).
 *
 * Chart context: timeframe, tickerid, exchange calendar (intrabar merge, bar close time), symbol tick (POC Level
 * text), `chart.fg_color` / `chart.bg_color` (`foregroundColorOf` / `backgroundColorOf`).
 *
 * Reference: "Volume Analysis - Heatmap and Volume Profile" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import {
  ta, Series, color, str, timeframe, label, line, box, table, resetDrawings, setDrawingBar, drawingOutputs,
  periodClose,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe } from '../anchor-period';
import {
  backgroundColorOf, foregroundColorOf, mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { otherSymbolChart, securityLowerTf } from '../other-symbol';

export interface VolumeAnalysisHeatmapAndVolumeProfileInputs {
  plan: 'Lower Tier' | 'Premium or Higher';
  cwidthi: number;
  cheight: number;
  location: 'Absolute' | 'Zero Line';
  icolorup: string;
  icolordn: string;
  showprofile: boolean;
  vahrate: number;
  vforceoverlay: boolean;
  showPOC: boolean;
  showPOCoMC: boolean;
  colorPOC: string;
  poclwidth: number;
  profilerow: number;
  profilelen: number;
  volcolorup: string;
  volcolordn: string;
  volcoloruphl: string;
  volcolordnhl: string;
  showvolume: boolean;
  showcumvolume: boolean;
  showdiffvolume: boolean;
  transpvolume: number;
  showclose: boolean;
  cpricecolor: string;
  cpricewidth: number;
  showbody: boolean;
  showinchart: boolean;
  showinfo: boolean;
  infotextsize: 'tiny' | 'small' | 'normal' | 'large';
  tableposy: 'bottom' | 'middle' | 'top';
  tableposx: 'left' | 'center' | 'right';
  transpempty: number;
  transpborder: number;
}

// Colours of Pine v5: yellow #FFEB3B, blue #2962FF, red #FF5252, gray #787B86; input defaults color.new(c, 30) /
// color.new(c, 70) keep an alpha of 0.7 / 0.3
const YELLOW = '#FFEB3B';
const BLUE = '#2962FF';
const RED = '#FF5252';
const GRAY = '#787B86';

export const defaultInputs: VolumeAnalysisHeatmapAndVolumeProfileInputs = {
  plan: 'Lower Tier',
  cwidthi: 7,
  cheight: 5,
  location: 'Absolute',
  icolorup: YELLOW,
  icolordn: BLUE,
  showprofile: true,
  vahrate: 70,
  vforceoverlay: false,
  showPOC: true,
  showPOCoMC: true,
  colorPOC: RED,
  poclwidth: 2,
  profilerow: 16,
  profilelen: 12,
  volcolorup: 'rgba(41, 98, 255, 0.7)',
  volcolordn: 'rgba(255, 235, 59, 0.7)',
  volcoloruphl: 'rgba(41, 98, 255, 0.3)',
  volcolordnhl: 'rgba(255, 235, 59, 0.3)',
  showvolume: true,
  showcumvolume: false,
  showdiffvolume: false,
  transpvolume: 70,
  showclose: true,
  cpricecolor: GRAY,
  cpricewidth: 1,
  showbody: false,
  showinchart: true,
  showinfo: true,
  infotextsize: 'small',
  tableposy: 'middle',
  tableposx: 'left',
  transpempty: 80,
  transpborder: 95,
};

const SETUP = '            SETUP';
const VOLUME = '            VOLUME';
const PROFILE = '          VOLUME PROFILE';
const EXTRAS = '            EXTRAS';
const PANEL = '          INFO PANEL';
const BACKGROUND = '         BACKGROUND';

export const inputConfig: InputConfig[] = [
  { id: 'plan', type: 'string', title: 'Plan', defval: 'Lower Tier', options: ['Lower Tier', 'Premium or Higher'], group: SETUP },
  { id: 'cwidthi', type: 'int', title: 'Number of Columns', defval: 7, min: 2, max: 20, group: SETUP },
  { id: 'cheight', type: 'int', title: 'Number of Rows', defval: 5, min: 2, max: 20, group: SETUP },
  { id: 'location', type: 'string', title: 'Location of Candles', defval: 'Absolute', options: ['Absolute', 'Zero Line'], group: SETUP },
  { id: 'icolorup', type: 'color', title: 'Colors', defval: YELLOW, inline: 'Colors', group: SETUP },
  { id: 'icolordn', type: 'color', title: '', defval: BLUE, inline: 'Colors', group: SETUP },
  { id: 'showprofile', type: 'bool', title: 'Volume Profile', defval: true, group: PROFILE },
  { id: 'vahrate', type: 'int', title: 'Value Area Volume', defval: 70, min: 0, max: 100, group: PROFILE },
  { id: 'vforceoverlay', type: 'bool', title: 'Show Volume Profile in Main Chart', defval: false, group: PROFILE },
  { id: 'showPOC', type: 'bool', title: 'Show POC', defval: true, group: PROFILE },
  { id: 'showPOCoMC', type: 'bool', title: 'Show POC in Main Chart', defval: true, group: PROFILE },
  { id: 'colorPOC', type: 'color', title: ' POC Line', defval: RED, inline: 'pocline', group: PROFILE },
  { id: 'poclwidth', type: 'int', title: '', defval: 2, min: 1, max: 4, inline: 'pocline', group: PROFILE },
  { id: 'profilerow', type: 'int', title: ' Number of Rows', defval: 16, min: 1, max: 25, group: PROFILE },
  { id: 'profilelen', type: 'int', title: ' Maximum Length', defval: 12, min: 5, max: 50, group: PROFILE },
  { id: 'volcolorup', type: 'color', title: 'Value Area Colors', defval: 'rgba(41, 98, 255, 0.7)', inline: 'volcol', group: PROFILE },
  { id: 'volcolordn', type: 'color', title: '', defval: 'rgba(255, 235, 59, 0.7)', inline: 'volcol', group: PROFILE },
  { id: 'volcoloruphl', type: 'color', title: 'VAH/VAL Colors', defval: 'rgba(41, 98, 255, 0.3)', inline: 'volcolhl', group: PROFILE },
  { id: 'volcolordnhl', type: 'color', title: '', defval: 'rgba(255, 235, 59, 0.3)', inline: 'volcolhl', group: PROFILE },
  { id: 'showvolume', type: 'bool', title: 'Show Volume', defval: true, group: VOLUME },
  { id: 'showcumvolume', type: 'bool', title: 'Cumulative', defval: false, group: VOLUME },
  { id: 'showdiffvolume', type: 'bool', title: 'Difference', defval: false, group: VOLUME },
  { id: 'transpvolume', type: 'int', title: 'Volume Transparency', defval: 70, min: 0, max: 100, step: 5, group: VOLUME },
  { id: 'showclose', type: 'bool', title: 'Closing Price', defval: true, inline: 'cprice', tooltip: 'Shows if Location is Absolute', group: EXTRAS },
  { id: 'cpricecolor', type: 'color', title: '', defval: GRAY, inline: 'cprice', group: EXTRAS },
  { id: 'cpricewidth', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'cprice', group: EXTRAS },
  { id: 'showbody', type: 'bool', title: 'Show Candle Body', defval: false, tooltip: 'Shows if Location is Absolute', group: EXTRAS },
  { id: 'showinchart', type: 'bool', title: 'Show Area In The Main Chart', defval: true, group: EXTRAS },
  { id: 'showinfo', type: 'bool', title: 'Info Panel', defval: true, group: PANEL },
  { id: 'infotextsize', type: 'string', title: ' Panel Size', defval: 'small', options: ['tiny', 'small', 'normal', 'large'], group: PANEL },
  { id: 'tableposy', type: 'string', title: ' Position', defval: 'middle', options: ['bottom', 'middle', 'top'], inline: 'infopos', group: PANEL },
  { id: 'tableposx', type: 'string', title: '', defval: 'left', options: ['left', 'center', 'right'], inline: 'infopos', group: PANEL },
  { id: 'transpempty', type: 'int', title: 'Empty Box Transparency', defval: 80, min: 0, max: 100, step: 5, group: BACKGROUND },
  { id: 'transpborder', type: 'int', title: 'Border Transparency', defval: 95, min: 40, max: 100, step: 5, group: BACKGROUND },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Volume Analysis - Heatmap and Volume Profile',
  shortTitle: 'VA',
  overlay: false,
};

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const feq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine int(): truncation, na stays na */
const int = (v: number) => (Number.isFinite(v) ? Math.trunc(v) : NaN);

/** The lower timeframe of getData() and its name in the info panel */
function lowerTimeframe(plan: string, candletime: number): { tfs: string; stf: string } {
  let tf = Math.max(Math.trunc(candletime / 1000), 1);
  if (plan === 'Premium or Higher' && candletime < 86400) {
    tf = tf <= 1 ? 1 : tf > 1 && tf < 6 ? 5 : tf > 5 && tf < 11 ? 10 : tf > 10 && tf < 21 ? 15 : tf > 20 && tf < 45 ? 30 : tf;
    return { tfs: `${tf}S`, stf: `${tf} Seconds` };
  }
  tf = Math.max(Math.trunc(tf / 60), 1);
  return { tfs: `${tf}`, stf: `${tf} Minutes` };
}

/** Chart timeframe and the bar size checks of the original */
function setup(cfg: VolumeAnalysisHeatmapAndVolumeProfileInputs, bars: ReadonlyArray<{ time: number }>, chart?: ChartContext) {
  const tf = chartTimeframe(bars, chart) || '1D';
  const candletime = timeframe.in_seconds(tf);
  const tfis = Math.trunc(candletime / 60);
  const lower = cfg.plan === 'Lower Tier';
  const cwidth = lower && tfis < cfg.cwidthi ? tfis : cfg.cwidthi;
  // chart.is_standard: taken as true
  const ok = (lower && tfis > 1) || (!lower && candletime >= 30);
  return { tf, candletime, cwidth, ok, ...lowerTimeframe(cfg.plan, candletime) };
}

/**
 * Bars the indicator needs: the chart symbol on the lower timeframe of the plan, and on charts above 1 day also its
 * daily bars (request.security_lower_tf(syminfo.tickerid, 'D', [time, time_close])). None when the chart timeframe
 * is not usable or unknown.
 */
export function requiredSymbols(
  inputs: Partial<VolumeAnalysisHeatmapAndVolumeProfileInputs> = {}, chart?: ChartContext,
): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  if (chartTimeframe([], chart) === '') return [];
  const s = setup(cfg, [], chart);
  if (!s.ok) return [];
  const symbol = tickeridOf(chart);
  const out: SymbolRequest[] = [];
  if (timeframe.in_seconds(s.tfs) !== s.candletime) out.push({ symbol, timeframe: s.tfs });
  if (s.candletime > 86400) out.push({ symbol, timeframe: '1D' });
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeAnalysisHeatmapAndVolumeProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const { tf, candletime, cwidth, ok, tfs, stf } = setup(cfg, bars, chart);
  const { cheight, profilerow, showprofile, showvolume, showdiffvolume, showcumvolume } = cfg;
  const absolute = cfg.location === 'Absolute';
  const toMs = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && n > 0 && bars[0].time >= 1e12) ? 1 : 1000;
  const ms = (t: number) => t * toMs;

  // maxcandles (per bar), hlLength, ta.highest / ta.lowest of the high / low
  const maxBase = Math.floor((500 - (showprofile ? profilerow * 2 : 0))
    / ((cheight + (showvolume ? (showdiffvolume ? 3 : 2) : 0)) * cwidth));
  const maxcandlesAt = (i: number) => (maxBase >= i ? i + 1 : maxBase);
  const hlLength = bars.map((_, i) => (i + 1 < maxcandlesAt(i) ? i + 1 : maxcandlesAt(i)));
  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const highestArr = ta.highest(Series.fromBars(bars, 'high'), Series.fromArray(bars, hlLength)).toArray().map(num);
  const lowestArr = ta.lowest(Series.fromBars(bars, 'low'), Series.fromArray(bars, hlLength)).toArray().map(num);
  const isOK = (i: number) => i > last - maxcandlesAt(i);

  resetDrawings({ box: 500, line: 500 });

  if (!ok) {
    // message label on the last bar
    if (n > 0) {
      setDrawingBar(last, true);
      const txt = `Please Set The Chart Timeframe ${cfg.plan === 'Lower Tier' ? '2 Minutes' : '30 Seconds'} or higher\nOr Change the Plan as Premium or Higher`;
      label.new(last - 40, bars[last].close, txt, 'bar_index', 'price', undefined, undefined, '#363A45');
      setDrawingBar(null);
    }
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      ...drawingOutputs(bars, toMs === 1 ? 'ms' : 's'),
    };
  }

  // ---- lower timeframe bars: request.security_lower_tf(syminfo.tickerid, tfs, [close, open, volume, time])
  const symbol = tickeridOf(chart);
  const sameTf = timeframe.in_seconds(tfs) === candletime;
  const requests: SymbolRequest[] = [];
  if (!sameTf) requests.push({ symbol, timeframe: tfs });
  if (candletime > 86400) requests.push({ symbol, timeframe: '1D' });
  const got = symbolBarsOf(requests, chart);
  const ltfBars = sameTf ? bars : got[0];
  const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
  const chartArg = otherSymbolChart(bars, chart);
  const ranges = sameTf ? bars.map((_, i) => [i, i + 1] as [number, number]) : securityLowerTf(bars, ltfBars, tfs, chartArg, calendar);
  const sessionCtx = { timeframe: tf, timezone: chart?.timezone ?? 'Etc/UTC', session: chart?.session ?? '24x7', timeUnit: 'ms' as const };
  // time_close of a bar (ms)
  const timeClose = (t: number, period: string) => periodClose(ms(t), period, sessionCtx);
  // daily bars inside each chart bar above 1 day: [time, time_close] (request.security_lower_tf(..., 'D', ...))
  let dayRanges: Array<[number, number]> | null = null;
  let dayBars: Bar[] = [];
  if (candletime > 86400) {
    dayBars = got[sameTf ? 0 : 1];
    dayRanges = securityLowerTf(bars, dayBars, '1D', chartArg, calendar);
  }

  // ---- state of the original (var / varip)
  const volprofiles: number[][] = [[], [], [], [], []];
  const volprofilelast: number[] = [];
  // matrices: row 0 is the newest bar
  const cols = cwidth * cheight;
  const arrBoxes: number[][] = [];
  const volBoxes: number[][] = [];
  const closeLines: number[][] = [];
  const closeindex: number[][] = [];
  const signmatrix: number[][] = [];
  const volmatrix: number[][] = [];
  const naRow = (k: number) => new Array<number>(k).fill(NaN);
  let maxboxsize = 0;
  // getTheCandle(): `var start`, `var end`
  let gStart = 0;
  let gEnd = -1;
  let mainclines: (Line | undefined)[] = [undefined, undefined, undefined];
  const allBoxes: Box[] = [];
  const allLines: Line[] = [];
  let infotable: ReturnType<typeof table.new> | undefined;

  const getColor = (bgcolint: number, body: boolean): string => {
    const transp = 80 - Math.abs(bgcolint) * 0.8;
    if (bgcolint > 0) return String(color.new(cfg.icolorup, transp));
    if (bgcolint < 0) return String(color.new(cfg.icolordn, transp));
    if (cfg.showbody) return String(body ? color.new(fg, 70) : color.new(fg, 90));
    return String(color.new(fg, cfg.transpempty));
  };

  // removeolddata(): remove the triplets of an age (array.indexof compares within 1e-10)
  const removeolddata = (arr: number[], age: number) => {
    for (;;) {
      const index = arr.findIndex((v) => feq(v, age));
      if (index === -1) break;
      for (let x = 1; x <= 3; x++) {
        if (index >= arr.length) throw new Error(`Error on bar: Index ${index} is out of bounds. Array size is ${arr.length}.`);
        arr.splice(index, 1);
      }
    }
  };
  const pick = (limit: number) => volprofiles.find((a, k) => k === 4 || a.length < limit)!;

  const start = Math.max(0, n - (maxBase + 2));
  for (let i = start; i < n; i++) {
    if (!isOK(i)) continue;
    setDrawingBar(i, i === last, last);
    const maxcandles = maxcandlesAt(i);
    const highest = highestArr[i];
    let lowest = lowestArr[i];
    const isLast = i === last;

    // intrabars of the bar
    const [from, to] = ranges[i];
    const arrClose: number[] = [];
    const arrOpen: number[] = [];
    const arrVolume: number[] = [];
    const arrTime: number[] = [];
    for (let j = from; j < to; j++) {
      const b = ltfBars[j];
      arrClose.push(b.close);
      arrOpen.push(b.open);
      arrVolume.push(num(b.volume));
      arrTime.push(ms(b.time));
    }

    // show included candles in the main chart
    if (cfg.showinchart) {
      for (const x of mainclines) if (x) line.delete(x);
      const heigth = (highest - lowest) / 5;
      if (maxcandles === 1) {
        mainclines = [line.new(i, lowest - heigth / 2, i, lowest - heigth * 2, 'bar_index', 'none', fg, 'arrow_left',
          undefined, true), mainclines[1], mainclines[2]];
      } else {
        const loc = [i - maxcandles + 1, i];
        mainclines[0] = line.new(i - maxcandles + 1, lowest - heigth * 2, i, lowest - heigth * 2, 'bar_index', 'none', fg,
          undefined, 2, true);
        for (let x = 0; x <= 1; x++) {
          mainclines[x + 1] = line.new(loc[x], lowest - heigth, loc[x], lowest - heigth * 2, 'bar_index', 'none', fg,
            undefined, undefined, true);
        }
      }
    }

    const profilestep = (highest - lowest) / profilerow;

    // removeEmtpytimes(): close the gaps between the sessions of a bar above 1 day
    if (dayRanges && arrTime.length > 0) {
      const [d0, d1] = dayRanges[i];
      if (d1 > d0) {
        const startt = dayBars.slice(d0, d1).map((b) => ms(b.time));
        const endt = dayBars.slice(d0, d1).map((b) => timeClose(b.time, '1D'));
        let k = arrTime.length - 1;
        while (arrTime[k] >= startt[startt.length - 1]) {
          k -= 1;
          if (k < 0) break;
        }
        let ind = startt.length - 1;
        let addition = 0;
        while (ind > 0) {
          ind -= 1;
          const ctime = startt[ind];
          addition += startt[ind + 1] - endt[ind];
          while (k >= 0) {
            if (arrTime[k] >= ctime) {
              arrTime[k] += addition;
              k -= 1;
            } else break;
          }
        }
      }
    }

    let maxboxheight = 0;
    // barstate.isnew: a new row for the bar
    arrBoxes.unshift(naRow(cols * 3));
    volBoxes.unshift(naRow(cwidth * 2));
    closeindex.unshift(naRow(2));
    closeLines.unshift(naRow(cwidth));
    signmatrix.unshift(naRow(cols));
    volmatrix.unshift(naRow(cols));
    // removeOldAddNewVol()
    const oldone = last - maxcandles;
    for (let k = 0; k < 5; k++) removeolddata(volprofiles[0], oldone);
    const target = pick(90000);
    if (volprofilelast.length > 0) target.push(...volprofilelast.slice());
    if (arrBoxes.length > maxcandles) {
      for (const m of [arrBoxes, volBoxes, closeindex, closeLines, signmatrix, volmatrix]) m.splice(maxcandles, 1);
    }

    for (const b of allBoxes) box.delete(b);
    allBoxes.length = 0;
    for (const l of allLines) line.delete(l);
    allLines.length = 0;
    volBoxes[0].fill(0);
    volmatrix[0].fill(0);
    signmatrix[0].fill(0);

    volprofilelast.length = 0;
    const volprofile = isLast ? volprofilelast : pick(80000);
    const maxvolbarsize = (highest - lowest) / 3;

    if (arrTime.length > 0) {
      const tclose = timeClose(bars[i].time, tf);
      const nettime = tclose - arrTime[0];
      const step = int(nettime / cwidth);
      let cclose = arrTime[0];
      let lastclose = i > 0 ? bars[i - 1].close : NaN;
      let lastsign = i > 0 && ge(bars[i - 1].close, bars[i - 1].open) ? 1 : -1;
      const age = i;
      const range = arrClose.length ? Math.max(...arrClose) - Math.min(...arrClose) : NaN;
      const arrmin = arrClose.length ? Math.min(...arrClose) : NaN;
      for (let cc = 0; cc < cwidth; cc++) {
        // getTheCandle(cclose, step, cc): binary search of the end of the column
        const getEnd = (l0: number) => {
          let l = l0;
          let h = arrTime.length - 1;
          let ret = -1;
          while (l <= h) {
            const mid = int(l + (h - l) / 2);
            if (arrTime[mid] >= cclose + step) {
              if (mid === 0) { ret = mid; break; }
              if (arrTime[mid - 1] < cclose + step) { ret = mid; break; }
            }
            if (arrTime[mid] < cclose + step) l = mid + 1;
            else h = mid - 1;
          }
          return ret === -1 ? arrTime.length : ret;
        };
        if (cc === 0) {
          gStart = 0;
          gEnd = getEnd(0);
        } else {
          gEnd = getEnd(gStart);
        }
        let cCls: number[] = [];
        let cOpn: number[] = [];
        let cVol: number[] = [];
        if (gStart < arrClose.length) {
          const endd = Math.min(gEnd, arrVolume.length);
          cCls = arrClose.slice(gStart, endd);
          cOpn = arrOpen.slice(gStart, endd);
          cVol = arrVolume.slice(gStart, endd);
        }
        gStart = gEnd;

        cclose += step;
        const stp = range / cheight;
        maxboxsize = Math.max(maxboxsize, stp);
        if (cCls.length > 0) {
          for (let x = 0; x < cCls.length; x++) {
            const cls = cCls[x];
            const index = Math.min(int((cls - arrmin) / stp), cheight - 1);
            if (cclose >= arrTime[arrTime.length - 1]) {
              closeindex[0][0] = index;
              closeindex[0][1] = cc;
            }
            let sgn = Math.sign(cls - (x === 0 ? lastclose : (feq(cls, cOpn[x]) ? cCls[x - 1] : cOpn[x])));
            sgn = sgn === 0 ? lastsign : sgn;
            lastsign = sgn;
            const cell = index + cc * cheight;
            signmatrix[0][cell] += sgn * cVol[x];
            volmatrix[0][cell] += cVol[x];
            volprofile.push(age, cls, sgn * cVol[x]);
            if (sgn < 0) volBoxes[0][cc * 2] -= cVol[x];
            else volBoxes[0][cc * 2 + 1] += cVol[x];
          }
          lastclose = cCls[cCls.length - 1];
          closeLines[0][cc] = cCls[cCls.length - 1];
        }
        const candloc = absolute ? arrmin : 0;
        for (let rr = 0; rr < cheight; rr++) {
          arrBoxes[0][cc * cheight * 3 + rr * 3] = candloc + rr * stp + stp;
          arrBoxes[0][cc * cheight * 3 + rr * 3 + 1] = candloc + rr * stp;
        }
      }
      // maxposnegvolumes(): largest volume of the boxes with a positive / other sign
      let posvol = 0;
      let negvol = 0;
      for (let r = 0; r < volmatrix.length; r++) {
        for (let x = 0; x < cols; x++) {
          if (Math.sign(signmatrix[r][x]) > 0) posvol = Math.max(posvol, volmatrix[r][x]);
          else negvol = Math.max(negvol, volmatrix[r][x]);
        }
      }
      const maxneg = -negvol;
      for (let r = 0; r < volmatrix.length; r++) {
        for (let c = 0; c < cols; c++) {
          const maxvolume = Math.sign(signmatrix[r][c]) > 0 ? posvol : maxneg;
          arrBoxes[r][c * 3 + 2] = int((100 * volmatrix[r][c]) / maxvolume);
        }
      }
    }

    // draw candle boxes and volume boxes
    let maxvolumebar = Math.max(...volBoxes.flat()) - Math.min(...volBoxes.flat());
    maxvolumebar *= showcumvolume ? 3 : 1;
    maxboxsize /= 3;
    let totalshowncandles = 0;
    for (let row = 0; row < arrBoxes.length; row++) {
      if (Number.isNaN(arrBoxes[row][0])) continue;
      totalshowncandles += 1;
      const candle = arrBoxes[row];
      if (i - (cwidth + 1) * row - cwidth < 1) break;
      let totalpositive = 0;
      let totalnegative = 0;
      const rb = bars[i - row];
      const currentbodyhigh = Math.max(rb.close, rb.open);
      const currentbodylow = Math.min(rb.close, rb.open);
      let totalvol = 0;
      const x0 = i - row * (cwidth + 1);
      for (let cc = 0; cc < cwidth; cc++) {
        for (let rr = 0; rr < cheight; rr++) {
          const bgcolint = int(candle[cc * cheight * 3 + rr * 3 + 2]);
          const bdcolor = bgcolint === 0 ? String(color.new(fg, cfg.transpborder)) : String(color.new(fg, 80));
          const top = candle[cc * cheight * 3 + rr * 3];
          const bottom = candle[cc * cheight * 3 + rr * 3 + 1];
          const body = absolute && bgcolint === 0 && ge(currentbodyhigh, bottom) && ge(top, currentbodylow);
          const currentone = rr === closeindex[row][0] && cc === closeindex[row][1];
          maxboxheight = Math.max(maxboxheight, top - bottom);
          allBoxes.push(box.new(x0 - (cwidth - (cc - 1)) + 1, top, x0 - (cwidth - cc) + 1, bottom,
            currentone ? String(color.new(fg, 40)) : bdcolor, 1, undefined, undefined, undefined, getColor(bgcolint, body)));
        }
        if (showvolume) {
          const negv = (maxvolbarsize * Math.abs(volBoxes[row][cc * 2])) / maxvolumebar;
          const posv = (maxvolbarsize * volBoxes[row][cc * 2 + 1]) / maxvolumebar;
          totalvol += posv - negv;
          totalpositive += posv;
          totalnegative += negv;
          const posone = showcumvolume ? totalpositive : posv;
          const negone = showcumvolume ? totalnegative : negv;
          const xl = x0 - (cwidth - cc);
          allBoxes.push(box.new(xl, candle[1] - maxboxsize, xl + 1, candle[1] - maxboxsize - posone, bg, 1, undefined,
            undefined, undefined, getColor(100 - cfg.transpvolume, false)));
          allBoxes.push(box.new(xl, candle[1] - maxboxsize - posone, xl + 1, candle[1] - maxboxsize - posone - negone, bg, 1,
            undefined, undefined, undefined, getColor(-(100 - cfg.transpvolume), false)));
          if (showdiffvolume) {
            const topY = candle[cheight * 3 - 3] + maxboxsize;
            allBoxes.push(box.new(xl, topY, xl + 1, topY + Math.abs(totalvol), bg, 1, undefined, undefined, undefined,
              getColor(Math.sign(totalvol) * (100 - cfg.transpvolume), false)));
          }
        }
      }
      // closing price (Location Absolute only)
      if (cfg.showclose && absolute && cwidth > 1) {
        const lines = closeLines[row];
        for (let x = 0; x <= cwidth - 2; x++) {
          if (Number.isNaN(lines[x + 1])) break;
          allLines.push(line.new(x0 - (cwidth - x), lines[x], x0 - (cwidth - x) + 1, lines[x + 1], 'bar_index', 'none',
            cfg.cpricecolor, undefined, cfg.cpricewidth));
        }
        if (row > 0) {
          allLines.push(line.new(x0, closeLines[row][cwidth - 1], x0 + 1, closeLines[row - 1][0], 'bar_index', 'none',
            cfg.cpricecolor, undefined, cfg.cpricewidth));
        }
      }
    }
    void maxboxheight;

    // volume profile (last bar)
    let poclevel = 0;
    const volumeprofile = new Array<number>(profilerow * 2).fill(0);
    if (isLast && showprofile && totalshowncandles > 0 && (absolute || cfg.vforceoverlay)) {
      lowest = bars[i].close;
      for (let x = 0; x < totalshowncandles; x++) lowest = Math.min(lowest, bars[i - x].low);
      const getprofile = (vp: number[]) => {
        for (let x = 0; x < vp.length; x += 3) {
          const val = vp[x + 2];
          const diff = vp[x + 1] - lowest;
          let index = Math.max(Math.min(int(diff / profilestep), profilerow - 1), 0);
          index = index * 2 + (val < 0 ? 1 : 0);
          volumeprofile[index] += val;
        }
      };
      for (const vp of volprofiles) getprofile(vp);
      getprofile(volprofilelast);

      // getvalarea()
      let index = 0;
      let max = 0;
      let totalval = 0;
      for (let x = 0; x < profilerow; x++) {
        const v = volumeprofile[x * 2] - volumeprofile[x * 2 + 1];
        totalval += v;
        if (gt(v, max)) {
          max = v;
          index = x;
        }
      }
      let upi = Math.min(index + 1, profilerow - 1);
      let dni = Math.max(index - 1, 0);
      const thiss = volumeprofile.slice();
      let total = max;
      thiss[index * 2] = 0;
      thiss[index * 2 + 1] = 0;
      const varea = [index];
      while (gt((totalval * cfg.vahrate) / 100, total)) {
        const up = thiss[upi * 2] - thiss[upi * 2 + 1];
        const dn = thiss[dni * 2] - thiss[dni * 2 + 1];
        if (gt(up, dn)) {
          total += up;
          thiss[upi * 2] = 0;
          thiss[upi * 2 + 1] = 0;
          varea.push(upi);
          upi = Math.min(upi + 1, profilerow - 1);
        } else {
          total += dn;
          thiss[dni * 2] = 0;
          thiss[dni * 2 + 1] = 0;
          varea.push(dni);
          dni = Math.max(dni - 1, 0);
        }
      }
      varea.sort((a, b) => a - b);

      const vmax = Math.max(Math.abs(Math.max(...volumeprofile)), Math.abs(Math.min(...volumeprofile)));
      let pocmax = 0;
      const force = cfg.vforceoverlay && totalshowncandles > 1;
      for (let x = 0; x < profilerow; x++) {
        const inArea = varea.includes(x);
        const colup = inArea ? cfg.volcolorup : cfg.volcoloruphl;
        const coldn = inArea ? cfg.volcolordn : cfg.volcolordnhl;
        const v1 = volumeprofile[x * 2];
        let boxw = int(cfg.profilelen * (v1 / vmax));
        const v2 = Math.abs(volumeprofile[x * 2 + 1]);
        let boxw1 = boxw + int(cfg.profilelen * (v2 / vmax));
        if (boxw1 === 0) {
          if (ge(v1, v2)) boxw = 1;
          else boxw1 = 1;
        }
        const yTop = lowest + profilestep * (x + 1);
        const yBot = lowest + profilestep * x;
        allBoxes.push(box.new(i + 2, yTop, i + 2 + boxw, yBot, bg, 1, undefined, undefined, undefined, colup, undefined,
          undefined, undefined, undefined, undefined, undefined, undefined, force));
        allBoxes.push(box.new(i + 2 + boxw, yTop, i + 2 + boxw1, yBot, bg, 1, undefined, undefined, undefined, coldn,
          undefined, undefined, undefined, undefined, undefined, undefined, undefined, force));
        if (boxw1 > pocmax) {
          pocmax = boxw1;
          poclevel = lowest + profilestep * (x + 0.5);
        }
      }
      if (gt(poclevel, 0) && absolute) {
        if (cfg.showPOC) {
          allLines.push(line.new(i - totalshowncandles * (cwidth + 1) + 1, poclevel, i, poclevel, 'bar_index', 'right',
            cfg.colorPOC, undefined, cfg.poclwidth));
        }
        if (cfg.showPOCoMC) {
          allLines.push(line.new(i - totalshowncandles + 1, poclevel, i + 1, poclevel, 'bar_index', 'right', cfg.colorPOC,
            undefined, cfg.poclwidth, true));
        }
      }
    }

    // info panel (last bar)
    if (isLast && cfg.showinfo) {
      infotable ??= table.new(`${cfg.tableposy}_${cfg.tableposx}` as Parameters<typeof table.new>[0], 2, 6, undefined, GRAY,
        2, bg, 1);
      table.merge_cells(infotable, 0, 0, 1, 0);
      table.cell(infotable, 0, 0, 'I N F O   P A N E L', undefined, undefined, bg, undefined, undefined, cfg.infotextsize,
        String(color.new(fg, 25)));
      const dataToShow = ['The number of analyzed candles', `${str.tostring(totalshowncandles)}/${str.tostring(maxcandles)}`,
        'Lower Time Frame', stf,
        'Number of Columns', str.tostring(cwidth),
        'Number of Rows', str.tostring(cheight),
        'POC Level', str.tostring(poclevel, 'mintick', mintickOf(chart))];
      const rows = showprofile && gt(poclevel, 0) ? 4 : 3;
      for (let y = 0; y <= rows; y++) {
        for (let x = 0; x <= 1; x++) {
          table.cell(infotable, x, y + 1, dataToShow[y * 2 + x], undefined, undefined, fg, x === 0 ? 'left' : 'right',
            undefined, cfg.infotextsize, String(color.new(fg, 70 - (y % 2) * 10)));
        }
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, toMs === 1 ? 'ms' : 's'),
  };
}

export const VolumeAnalysisHeatmapAndVolumeProfile = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, requiredSymbols,
};
