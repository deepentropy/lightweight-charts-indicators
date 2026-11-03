/**
 * Momentum Acceleration by DGT (SpeedyGonzales)
 *
 * Momentum acceleration of the close (or of the On Balance Volume, "Data Source"): v = sma(change(src, t) / t, 3),
 * a = change(v, t) / t, value = v - a (t = "Acceleration Period"). The value is drawn as arrows (up for a positive
 * value in the bullish colour, down for a negative value in the bearish colour; the arrow height that follows the
 * value is not ported), with a triangle below the bar where the value turns positive and above the bar where it
 * turns negative. Arrows and triangles are shown on the last "Display Length" bars only (show_last).
 *
 * Oscillator projection view (off by default): on the last bar, the acceleration of the price and / or of the OBV
 * over the last min(last bar index, "Display Length") bars is drawn on the price chart as line segments, scaled to
 * the price range of that window and placed at its top or bottom, with a dashed grey mid line.
 *
 * Backtest framework (off by default): the trades follow the crosses of the value over / under 0, confirmed one bar
 * later (entry at the open of the next bar), within the last "Period (Years)" years before the current time, with
 * an optional stop loss. It draws entry / exit labels, early warning labels, a statistics label after the last bar
 * and the entry / exit price as circles.
 *
 * Alerts: the alertconditions (`alerts` of the result) on the crosses of the value over / under 0 ("Early Warning")
 * and one bar later ("Trading Opportunity"); with the backtest on, the alert() calls (`alertCalls`, once per bar) of
 * the entries, of the stop loss and of the early warnings, as the original. The table at the bottom right shows the
 * logo of the original.
 *
 * Chart context (optional third argument of calculate): the current time (`timenow`, the backtest period and the
 * statistics), the symbol tick (`syminfo.mintick`, the floor of the trade prices), the ticker id (alert texts) and
 * the chart timeframe (statistics text). Without it the port uses the computer clock, a tick of 0.01 and the
 * timeframe of the bar spacing.
 *
 * Reference: "Momentum Acceleration by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import {
  ta, str, color, label, line, table, Series, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Label, type ShapeConfig, type ArrowConfig,
  type ArrowData,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, MarkerData, TableData } from '../types';
import { mintickOf, nowOf, tickeridOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { chartTimeframe } from '../anchor-period';
import type { StudyDrawingKind } from '../style-outputs';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface MomentumAccelerationByDgtInputs {
  /** Data Source */
  s: 'Price' | 'On Balance Volume';
  /** Acceleration Period */
  t: number;
  /** Bullish Color */
  colorup: string;
  /** Bearish Color */
  colordown: string;
  /** Display Length (bars shown for the arrows and triangles) */
  p: number;
  /** Show Price Acceleration */
  price: boolean;
  oscColor: string;
  /** Show OBV Acceleration */
  obv: boolean;
  oscColor2: string;
  /** Scale (1 .. 10) */
  scale: number;
  /** Offset (-3 .. 10, tenths of the price range) */
  offset: number;
  oscPlacement: 'Top' | 'Bottom';
  isBackTest: boolean;
  tradeMode: 'Long Only' | 'Short Only' | 'Both';
  reverseOnSignal: boolean;
  dasCapital: number;
  lenBckTst: number;
  isStopLoss: boolean;
  /** Stop loss in % */
  stopLoss: number;
  useCandleL: boolean;
  useCandleS: boolean;
  isSudden: boolean;
  isTest: boolean;
  lblInOutSL: boolean;
  lblWarnings: boolean;
  lblTrdStat: boolean;
}

const TEAL = '#089981';
const RED = '#F23645';
const GRAY = '#787B86';
const AQUA = '#00BCD4';
const ORANGE = '#FF9800';

export const defaultInputs: MomentumAccelerationByDgtInputs = {
  s: 'Price',
  t: 13,
  // input.color(color.new(color.aqua / color.orange, 80)): alpha 0.2 as an input
  colorup: 'rgba(0, 188, 212, 0.2)',
  colordown: 'rgba(255, 152, 0, 0.2)',
  p: 233,
  price: false,
  oscColor: AQUA,
  obv: false,
  oscColor2: ORANGE,
  scale: 7,
  offset: 3,
  oscPlacement: 'Bottom',
  isBackTest: false,
  tradeMode: 'Both',
  reverseOnSignal: true,
  dasCapital: 1000,
  lenBckTst: 1,
  isStopLoss: false,
  stopLoss: 1,
  useCandleL: false,
  useCandleS: false,
  isSudden: true,
  isTest: false,
  lblInOutSL: true,
  lblWarnings: true,
  lblTrdStat: true,
};

const EM = '  ';
const SG = 'Momentum Acceleration Engine';
const OCS = 'Oscillator Projection View';
const BT = '=============   Backtest Framework   =============';
export const inputConfig: InputConfig[] = [
  { id: 's', type: 'string', title: 'Data Source', defval: 'Price', options: ['Price', 'On Balance Volume'], group: SG,
    tooltip: 'Select the data used to calculate momentum acceleration.\n\n• Price → Uses market price movement\n• On Balance Volume → Uses volume flow dynamics' },
  { id: 't', type: 'int', title: EM + 'Acceleration Period', defval: 13, group: SG,
    tooltip: 'Controls how quickly momentum acceleration reacts to market changes.\n\nLower values → Faster and more sensitive\nHigher values → Smoother and more stable' },
  { id: 'colorup', type: 'color', title: EM + 'Bullish Color', defval: 'rgba(0, 188, 212, 0.2)', inline: 'COL', group: SG,
    tooltip: 'Color used when momentum acceleration is positive.' },
  { id: 'colordown', type: 'color', title: 'Bearish Color', defval: 'rgba(255, 152, 0, 0.2)', inline: 'COL', group: SG,
    tooltip: 'Color used when momentum acceleration is negative.' },
  { id: 'p', type: 'int', title: EM + 'Display Length', defval: 233, min: 1, step: 10, group: SG,
    tooltip: 'Number of recent bars shown for momentum arrows.' },
  { id: 'price', type: 'bool', title: 'Show Price Acceleration', defval: false, inline: 'price', group: OCS,
    tooltip: 'Projects price-based momentum acceleration onto the chart.' },
  { id: 'oscColor', type: 'color', title: '', defval: AQUA, inline: 'price', group: OCS },
  { id: 'obv', type: 'bool', title: 'Show OBV Acceleration', defval: false, inline: 'obv', group: OCS,
    tooltip: 'Projects On Balance Volume momentum acceleration onto the chart.' },
  { id: 'oscColor2', type: 'color', title: '', defval: ORANGE, inline: 'obv', group: OCS },
  { id: 'scale', type: 'int', title: EM + 'Scale', defval: 7, min: 1, max: 10, inline: 'AA', group: OCS },
  { id: 'offset', type: 'int', title: 'Offset', defval: 3, min: -3, max: 10, inline: 'AA', group: OCS,
    tooltip: 'Scale:\nControls vertical scaling of the projected oscillator.\n\nOffset:\nAdjusts vertical placement of the oscillator projection.' },
  { id: 'oscPlacement', type: 'string', title: EM + 'Placement', defval: 'Bottom', options: ['Top', 'Bottom'], group: OCS,
    tooltip: 'Select where the oscillator is drawn relative to price.' },
  { id: 'isBackTest', type: 'bool', title: 'Enable Backtest', defval: false, group: BT,
    tooltip: 'Enable or disable the backtest framework.\n• ON  → trades simulated using the rules below\n• OFF → only live signals shown' },
  { id: 'tradeMode', type: 'string', title: 'Trade Mode', defval: 'Both', options: ['Long Only', 'Short Only', 'Both'], group: BT,
    tooltip: 'Defines which trade directions are simulated.\n\n• Long Only  — enters on long signal, exits on short signal or stop loss\n• Short Only — enters on short signal, exits on long signal or stop loss\n• Both       — enters on either signal, optionally reverses on the opposite' },
  { id: 'reverseOnSignal', type: 'bool', title: 'Reverse on Opposite Signal', defval: true, group: BT,
    tooltip: 'Only applies when Trade Mode is Both.\nWhen enabled, an opposite signal immediately closes the current trade\nand opens a new one in the other direction — always in trade once started.\nWhen disabled, opposite signal exits only — no new trade until next entry signal.' },
  { id: 'dasCapital', type: 'float', title: 'Initial Capital', defval: 1000, group: BT,
    tooltip: 'Starting capital for the simulation.\nUsed to calculate compounding PnL and final equity.' },
  { id: 'lenBckTst', type: 'float', title: 'Period (Years)', defval: 1, min: 0, step: 0.1, group: BT,
    tooltip: 'Lookback window for the simulation in years.\nCapped automatically if the selected timeframe has insufficient history.' },
  { id: 'isStopLoss', type: 'bool', title: 'Apply Stop Loss', defval: false, inline: 'sl', group: BT,
    tooltip: 'Exits the trade if price moves against the position intrabar.\nLong SL : low  reaches entry × (1 − %)\nShort SL: high reaches entry × (1 + %)' },
  { id: 'stopLoss', type: 'float', title: '  %', defval: 1, min: 0, step: 0.1, inline: 'sl', group: BT },
  { id: 'useCandleL', type: 'bool', title: 'Long Candle Confirmation', defval: false, group: BT,
    tooltip: 'Long entries only taken on bullish bars (close > open).' },
  { id: 'useCandleS', type: 'bool', title: 'Short Candle Confirmation', defval: false, group: BT,
    tooltip: 'Short entries only taken on bearish bars (close < open).' },
  { id: 'isSudden', type: 'bool', title: 'Avoid Same-Bar Conflicts', defval: true, group: BT,
    tooltip: 'Skips entries when both long and short signals fire on the same bar.\nReduces false entries from volatile spikes.' },
  { id: 'isTest', type: 'bool', title: '❗ Next Bar Mode (Repaints)', defval: false, group: BT,
    tooltip: 'Uses the next bar\'s open for simulation instead of the confirmed bar open.\nProduces earlier entries but signals will repaint.\nFor testing and comparison only — do not use for live alerts.' },
  { id: 'lblInOutSL', type: 'bool', title: 'Show Entry / Exit Labels', defval: true, group: BT,
    tooltip: 'Displays L / S / SL / TP labels at entry and exit bars with tooltips showing direction, price, change, and capital.' },
  { id: 'lblWarnings', type: 'bool', title: 'Show Early Warnings', defval: true, group: BT,
    tooltip: 'Shows a ⚠️ label when a signal fires but has not yet been confirmed.\nLabel is deleted on the following bar regardless of outcome.' },
  { id: 'lblTrdStat', type: 'bool', title: 'Show Trade Statistics', defval: true, group: BT,
    tooltip: 'Displays a floating label with full trade summary.\nIncludes win rate, PnL, long/short breakdown, and current trade status.' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Entry / Exit Price', color: GRAY, lineWidth: 1, style: 'circles', forceOverlay: true, editable: false },
];

/** plotarrow(psgval, 'Momentum Acceleration', colorup, colordown, show_last = p) */
export const arrowConfig: ArrowConfig[] = [
  { id: 'arrow0', title: 'Momentum Acceleration', colorup: defaultInputs.colorup, colordown: defaultInputs.colordown, minheight: 5, maxheight: 100 },
];

/** plotshape() declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bull', style: 'triangleup', location: 'belowbar', color: String(color.new(defaultInputs.colorup, 25)), size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Bear', style: 'triangledown', location: 'abovebar', color: String(color.new(defaultInputs.colordown, 25)), size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'table'];

export const metadata = {
  title: 'Momentum Acceleration by DGT',
  shortTitle: 'SpeedyGonzales ☼☾',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Average number of ms in a year, as the source */
const YEAR = 31556952000;

export function calculate(
  bars: Bar[],
  inputs: Partial<MomentumAccelerationByDgtInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  markers: MarkerData[]; arrows: ArrowData[]; labels: LabelData[]; lines: LineDrawingData[]; tables: TableData[];
  alerts: AlertConditionState[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const t = Math.trunc(cfg.t);
  const p = Math.trunc(cfg.p);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const past = (x: number[], k: number, i: number) => (i - k >= 0 ? x[i - k] : NaN);
  const closeS = new Series(bars, (b) => b.close);
  const obvS = ta.obv(bars);

  // f_speedy(_d, _t): v = ta.sma(ta.change(_d, _t) / _t, 3); a = ta.change(v, _t) / _t; v - a
  const speedy = (d: Series) => {
    const ch = A(ta.change(d, t)).map((x) => x / t);
    const v = A(ta.sma(Series.fromArray(bars, ch), 3));
    return v.map((x, i) => x - (x - past(v, t, i)) / t);
  };
  const psgval = speedy(cfg.s === 'Price' ? closeS : obvS);
  const psgS = Series.fromArray(bars, psgval);

  // show_last = p: the arrows and triangles of the last p bars are drawn
  const shown = (i: number) => i >= n - p;
  const arrows: ArrowData[] = [];
  const markers: MarkerData[] = [];
  const bullCol = String(color.new(cfg.colorup, 25));
  const bearCol = String(color.new(cfg.colordown, 25));
  for (let i = 0; i < n; i++) {
    if (!shown(i)) continue;
    const v = psgval[i];
    // plotarrow: no arrow on na or 0
    if (Number.isFinite(v) && v !== 0) {
      arrows.push({ time: bars[i].time, id: 'arrow0', value: v, color: v > 0 ? cfg.colorup : cfg.colordown });
    }
    const prev = past(psgval, 1, i);
    if (gt(v, 0) && le(prev, 0)) {
      markers.push({ id: 'shape0', time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: bullCol, size: 'tiny' });
    }
    if (lt(v, 0) && ge(prev, 0)) {
      markers.push({ id: 'shape1', time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: bearCol, size: 'tiny' });
    }
  }

  // alertconditions: ta.cross / ta.crossover / ta.crossunder(psgval, 0) and the same one bar later
  const both = ta.cross(psgS, 0).toArray().map(Boolean);
  const longAlert = ta.crossover(psgS, 0).toArray().map(Boolean);
  const shortAlert = ta.crossunder(psgS, 0).toArray().map(Boolean);
  const hist = (x: boolean[], k: number, i: number) => (i - k >= 0 ? x[i - k] : false);
  const lag = (x: boolean[]) => x.map((_, i) => hist(x, 1, i));
  const alerts = alertStates(alertConditions, bars, [both, lag(both), longAlert, lag(longAlert), shortAlert, lag(shortAlert)]);

  // ── Oscillator projection view ──
  resetDrawings({ line: 500 });
  const oscHight = 11 - Math.trunc(cfg.scale);
  const oscVerticalOffset = Math.trunc(cfg.offset) / 10;
  const oscLookbackLength = Math.min(last, p);
  const oscPrice = speedy(closeS);
  const oscObv = speedy(obvS);
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const hhArr = A(ta.highest(highS, oscLookbackLength));
  const llArr = A(ta.lowest(lowS, oscLookbackLength));
  const oscHighestArr = A(ta.highest(Series.fromArray(bars, oscPrice), oscLookbackLength));
  const oscHighest2Arr = A(ta.highest(Series.fromArray(bars, oscObv), oscLookbackLength));

  // ── Backtest framework ──
  const alertCalls: AlertCall[] = [];
  const tickerid = tickeridOf(chart);
  const now = nowOf(chart);
  const mintick = mintickOf(chart);
  const ms = (time: number) => (time >= 1e12 ? time : time * 1000);
  const period = chartTimeframe(bars, chart);
  const stopLoss = cfg.stopLoss / 100;
  const canLong = cfg.tradeMode !== 'Short Only';
  const canShort = cfg.tradeMode !== 'Long Only';
  const fmt2 = (x: number) => str.tostring(x, '#.##');

  let dir = 0;
  let entry = 0;
  let exit = 0;
  let cap = cfg.dasCapital;
  let trades = 0;
  let winL = 0;
  let lossL = 0;
  let winS = 0;
  let lossS = 0;
  const wLabel = varDrawing<Label>();
  let wLabelPrev: Label | undefined;
  const statLbl = varDrawing<Label>();
  let years = NaN;

  type Point = { time: number; value: number; color: string };
  const exitPlot: Point[] = [];
  const logo = varDrawing<ReturnType<typeof table.new>>();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === last);
    const b = bars[i];

    if (i === last) {
      // priceChangeRate and the window extremes moved by the offset
      const hh0 = hhArr[i];
      const ll0 = llArr[i];
      const priceChangeRate = (hh0 - ll0) / hh0;
      const priceLowest = ll0 * (1 - priceChangeRate * oscVerticalOffset);
      const priceHighest = hh0 * (1 + priceChangeRate * oscVerticalOffset);
      const oscHighest = oscHighestArr[i];
      const oscHighest2 = oscHighest2Arr[i];
      const hight = priceChangeRate / oscHight;
      const base = cfg.oscPlacement === 'Top' ? priceHighest : priceLowest;
      let count = 0;
      if (cfg.price || cfg.obv) {
        const midLevel = base * (1 + 0 / oscHighest * hight);
        line.new(i - oscLookbackLength, midLevel, i, midLevel, 'bar_index', 'none', String(color.new(color.gray, 25)), 'dashed', 1);
        count += 1;
      }
      for (let k = 0; k <= oscLookbackLength - 1; k++) {
        if (count < 498) {
          if (cfg.price) {
            line.new(i - k, base * (1 + past(oscPrice, k, i) / oscHighest * hight), i - k - 1,
              base * (1 + past(oscPrice, k + 1, i) / oscHighest * hight), 'bar_index', 'none', cfg.oscColor, 'solid', 1);
            count += 1;
          }
          if (cfg.obv) {
            line.new(i - k, base * (1 + past(oscObv, k, i) / oscHighest2 * hight), i - k - 1,
              base * (1 + past(oscObv, k + 1, i) / oscHighest2 * hight), 'bar_index', 'none', cfg.oscColor2, 'solid', 1);
            count += 1;
          }
        }
      }
    }

    const startBckTst = ms(b.time) > now - cfg.lenBckTst * YEAR;

    const fOpen = (d: number, lbl: boolean) => {
      entry = b.open;
      dir = d;
      trades += 1;
      if (lbl) {
        label.new(i, d === 1 ? b.low : b.high, d === 1 ? 'L' : 'S', 'bar_index', 'price', d === 1 ? TEAL : RED,
          d === 1 ? 'label_up' : 'label_down', '#FFFFFF', 'tiny', undefined,
          'Direction .... : ' + (d === 1 ? 'Long' : 'Short') + '\n'
          + 'Entry price .. : ' + str.tostring(b.open) + '\n'
          + 'Capital ...... : ' + fmt2(cap), undefined, true);
      }
    };
    const fClose = (isSL: boolean, lbl: boolean) => {
      const d = dir;
      const ep = entry;
      const xp = isSL ? b.close : b.open;
      exit = xp;
      const entrySafe = Math.max(ep, mintick);
      const exitSafe = Math.max(xp, mintick);
      const pnl = d === 1 ? exitSafe / entrySafe : entrySafe / exitSafe;
      const newCap = cap * pnl;
      const profit = gt(pnl, 1);
      cap = newCap;
      if (d === 1) {
        winL += profit ? 1 : 0;
        lossL += profit ? 0 : 1;
      } else {
        winS += profit ? 1 : 0;
        lossS += profit ? 0 : 1;
      }
      if (lbl) {
        label.new(i, d === 1 ? b.high : b.low, isSL ? 'SL' : 'TP', 'bar_index', 'price', profit ? TEAL : RED,
          d === 1 ? 'label_down' : 'label_up', '#FFFFFF', 'tiny', undefined,
          'Exit type .... : ' + (isSL ? 'Stop Loss' : 'Take Profit') + '\n'
          + 'Direction .... : ' + (d === 1 ? 'Long' : 'Short') + '\n'
          + 'Entry / Exit . : ' + str.tostring(ep) + ' / ' + str.tostring(xp) + '\n'
          + 'Change ....... : ' + fmt2((pnl - 1) * 100) + '%\n'
          + 'Capital ...... : ' + fmt2(newCap), undefined, true);
      }
      dir = 0;
    };

    if (cfg.isBackTest) {
      const sigL = cfg.isTest ? hist(longAlert, 1, i) : hist(longAlert, 2, i);
      const sigS = cfg.isTest ? hist(shortAlert, 1, i) : hist(shortAlert, 2, i);
      const candleRef = cfg.isTest ? 0 : 1;
      const conflict = hist(longAlert, candleRef, i) && hist(shortAlert, candleRef, i);
      const ref = i - candleRef >= 0 ? bars[i - candleRef] : null;
      const okL = (!cfg.useCandleL || (ref !== null && gt(ref.close, ref.open))) && (!cfg.isSudden || !conflict);
      const okS = (!cfg.useCandleS || (ref !== null && lt(ref.close, ref.open))) && (!cfg.isSudden || !conflict);
      const longCond = sigL && okL;
      const shortCond = sigS && okS;
      const slL = cfg.isStopLoss && dir === 1 && le(b.low, entry * (1 - stopLoss));
      const slS = cfg.isStopLoss && dir === -1 && ge(b.high, entry * (1 + stopLoss));
      const slHit = slL || slS;

      if (startBckTst) {
        let reversed = false;
        if (cfg.reverseOnSignal && cfg.tradeMode === 'Both') {
          if (dir === 1 && shortCond) {
            fClose(false, cfg.lblInOutSL);
            if (canShort) fOpen(-1, cfg.lblInOutSL);
            reversed = true;
          } else if (dir === -1 && longCond) {
            fClose(false, cfg.lblInOutSL);
            if (canLong) fOpen(1, cfg.lblInOutSL);
            reversed = true;
          }
        }
        if (!reversed) {
          const exitL = dir === 1 && (shortCond || slHit);
          const exitS = dir === -1 && (longCond || slHit);
          if (exitL || exitS) fClose(slHit, cfg.lblInOutSL);
        }
        const call = (what: string) => alertCalls.push({
          time: b.time, message: what + ' — ' + tickerid + ' | Price: ' + str.tostring(b.close), freq: 'once_per_bar',
        });
        if (dir === 0) {
          if (longCond && canLong) {
            fOpen(1, cfg.lblInOutSL);
            call('Long entry');
          }
          if (shortCond && canShort) {
            fOpen(-1, cfg.lblInOutSL);
            call('Short entry');
          }
        }
        if (slHit) call('Stop loss');
      }

      // early warnings: the label of the bar before is deleted on every bar after the first
      if (cfg.lblWarnings) {
        if (canLong && dir !== 1 && hist(longAlert, 1, i) && !shortAlert[i]) {
          wLabel.value = label.new(i, b.low, '⚠️', 'bar_index', 'price', TEAL, 'none', '#FFFFFF', 'large', undefined,
            'Probable long entry — awaiting confirmation\nIf confirmed, trade executes at next bar open.', undefined, true);
          if (wLabelPrev) label.delete(wLabelPrev);
          alertCalls.push({ time: b.time, message: 'Long early warning — ' + tickerid + ' | Price: ' + str.tostring(b.close), freq: 'once_per_bar' });
        }
        if (canShort && dir !== -1 && hist(shortAlert, 1, i) && !longAlert[i]) {
          wLabel.value = label.new(i, b.high, '⚠️', 'bar_index', 'price', RED, 'none', '#FFFFFF', 'large', undefined,
            'Probable short entry — awaiting confirmation\nIf confirmed, trade executes at next bar open.', undefined, true);
          if (wLabelPrev) label.delete(wLabelPrev);
          alertCalls.push({ time: b.time, message: 'Short early warning — ' + tickerid + ' | Price: ' + str.tostring(b.close), freq: 'once_per_bar' });
        }
        // bool(ta.change(time)): na on the first bar, then true
        if (i > 0 && wLabelPrev) label.delete(wLabelPrev);
      }

      if (cfg.lblTrdStat) {
        if (i === 0) years = (now - ms(b.time)) / YEAR;
        const totalTrades = trades;
        const totalWin = winL + winS;
        const totalLoss = lossL + lossS;
        const estimated = dir === 1 ? cap * (b.close / entry) : dir === -1 ? cap * (entry / b.close) : cap;
        const winRate = totalTrades > 0 ? totalWin / totalTrades * 100 : 0;
        const gainPct = (estimated / cfg.dasCapital - 1) * 100;
        const tradeDirTxt = dir === 1 ? 'Long' : dir === -1 ? 'Short' : 'Flat';
        const short = lt(years, cfg.lenBckTst);
        const perTxt = short
          ? fmt2(cfg.lenBckTst) + ' Yrs *** (' + str.tostring(i) + ' bars max)'
          : fmt2(cfg.lenBckTst) + ' Year(s)';
        const slTxt = cfg.isStopLoss
          ? str.tostring(stopLoss * 100, '#.#') + '% — level: '
            + fmt2(dir === 1 ? entry * (1 - stopLoss) : dir === -1 ? entry * (1 + stopLoss) : 0)
          : 'Off';
        const sep = '\n═════════════════════════════════════';
        const txt = '☼☾ Trade Statistics | ' + period
          + ' | ' + perTxt + ' | Trade Mode : ' + cfg.tradeMode
          + sep
          + '\nWin Rate : ' + str.tostring(winRate, '#.#') + '%'
          + ' | Trades : ' + str.tostring(totalTrades)
          + '\nWin/Loss : ' + str.tostring(totalWin) + '/' + str.tostring(totalLoss)
          + ' | Long  W/L : ' + str.tostring(winL) + '/' + str.tostring(lossL)
          + ' | Short W/L : ' + str.tostring(winS) + '/' + str.tostring(lossS)
          + sep
          + '\nGain/Loss : ' + fmt2(gainPct) + '%'
          + ' | Initial/Final Capital : ' + fmt2(cfg.dasCapital) + '/' + fmt2(estimated)
          + sep
          + '\nStatus : ' + tradeDirTxt
          + (dir !== 0
            ? ' | Entry Price : ' + str.tostring(entry)
              + ' | Unrealized : ' + fmt2((estimated / cap - 1) * 100) + '%'
              + '\nStop Loss : ' + slTxt
            : '')
          + (short ? '\n*** max available history for this timeframe' : '');
        const statCol = gt(gainPct, 0) ? TEAL : lt(gainPct, 0) ? RED : GRAY;
        if (statLbl.value) label.delete(statLbl.value);
        statLbl.value = label.new(i + 5, b.close, txt, 'bar_index', 'price', statCol, 'label_left', '#FFFFFF', 'small',
          'left', undefined, undefined, true);
      }
      wLabelPrev = wLabel.value;
    }

    // plot(bt_dir() != 0 ? bt_entry() : bt_exit() > 0 ? bt_exit() : na, force_overlay = true)
    exitPlot.push({
      time: b.time,
      value: dir !== 0 ? entry : gt(exit, 0) ? exit : NaN,
      color: dir === 1 ? TEAL : dir === -1 ? RED : GRAY,
    });

    // var table logo = table.new(position.bottom_right, 1, 1); its cell on the last bar
    if (i === 0) logo.value = table.new('bottom_right', 1, 1);
    if (i === last && logo.value) {
      table.cell(logo.value, 0, 0, '☼☾  ', undefined, undefined, TEAL, undefined, undefined, 'normal', undefined, 'SoleMare Analytics');
    }
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars);
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: exitPlot },
    markers,
    arrows,
    labels: drawn.labels ?? [],
    lines: drawn.lines ?? [],
    tables: drawn.tables ?? [],
    alerts,
    alertCalls,
  };
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Early Warning', message: 'SpeedyGonzales : Probable Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
  { id: 'alert1', title: 'Trading Opportunity', message: 'SpeedyGonzales : Probable Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
  { id: 'alert2', title: 'Long : Early Warning', message: 'SpeedyGonzales - Not Confirmed Probable Long Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
  { id: 'alert3', title: 'Long : Trading Opportunity', message: 'SpeedyGonzales - Probable Long Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
  { id: 'alert4', title: 'Short : Early Warning', message: 'SpeedyGonzales - Not Confirmed Probable Short Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
  { id: 'alert5', title: 'Short : Trading Opportunity', message: 'SpeedyGonzales - Probable Short Trade Opportunity\n{{exchange}}:{{ticker}}->\nPrice = {{close}},\nTime = {{time}}' },
];

export const MomentumAccelerationByDgt = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, arrowConfig, shapeConfig, drawingKinds, alertConditions,
  hasAlertFunction,
};
