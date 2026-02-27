/**
 * Renko Chart
 *
 * Renko brick overlay indicator with ATR-based or fixed box sizing.
 * Tracks brick open/close levels and generates trend direction.
 * Includes a breakout detection system and an EMA-based trend filter
 * with configurable reversal thresholds.
 *
 * Reference: TradingView "Renko Chart" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface RenkoChartInputs {
  mode: 'ATR' | 'Traditional';
  atrPeriod: number;
  boxSize: number;
  source: 'close' | 'hl';
  showBreakout: boolean;
  breakoutLength: number;
  showTrend: boolean;
  trendEmaLength: number;
  barcountWhip: number;
  trendThreshold: number;
  trendThresholdReversal: number;
  changeBarCol: boolean;
}

export const defaultInputs: RenkoChartInputs = {
  mode: 'ATR',
  atrPeriod: 14,
  boxSize: 10.0,
  source: 'hl',
  showBreakout: true,
  breakoutLength: 1,
  showTrend: true,
  trendEmaLength: 34,
  barcountWhip: 3,
  trendThreshold: 3.0,
  trendThresholdReversal: 1.5,
  changeBarCol: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Method', defval: 'ATR', options: ['ATR', 'Traditional'] },
  { id: 'atrPeriod', type: 'int', title: '[ATR] Atr Period', defval: 14, min: 1 },
  { id: 'boxSize', type: 'float', title: '[Traditional] Brick Size', defval: 10.0, min: 0.000001 },
  { id: 'source', type: 'string', title: 'Source', defval: 'hl', options: ['close', 'hl'] },
  { id: 'showBreakout', type: 'bool', title: 'Show Breakout Trend', defval: true },
  { id: 'breakoutLength', type: 'int', title: 'Length for Breakout', defval: 1, min: 1 },
  { id: 'showTrend', type: 'bool', title: 'Show Trend', defval: true },
  { id: 'trendEmaLength', type: 'int', title: 'Trend EMA Length', defval: 34, min: 1 },
  { id: 'barcountWhip', type: 'int', title: 'Wait # Bars for Reversal', defval: 3, min: 0 },
  { id: 'trendThreshold', type: 'float', title: 'Trend Threshold', defval: 3.0, min: 0, step: 0.1 },
  { id: 'trendThresholdReversal', type: 'float', title: 'Trend Threshold for Reversal', defval: 1.5, min: 0, step: 0.1 },
  { id: 'changeBarCol', type: 'bool', title: 'Change Bar Colors', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'renkoOpen', title: 'Renko Open', color: '#808080', lineWidth: 1 },
  { id: 'renkoClose', title: 'Renko Close', color: '#808080', lineWidth: 1 },
  { id: 'breakoutLine', title: 'Renko Breakout', color: '#00FF00', lineWidth: 3 },
  { id: 'trendLine', title: 'Trend', color: '#008000', lineWidth: 3 },
];

export const metadata = {
  title: 'Renko Chart',
  shortTitle: 'Renko',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RenkoChartInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const reversal = 2;

  // ATR for box sizing
  const atrArr = ta.atr(bars, cfg.atrPeriod).toArray();

  // Renko brick state arrays
  const trend: number[] = new Array(n).fill(0);
  const iopenprice: number[] = new Array(n).fill(0);
  const icloseprice: number[] = new Array(n).fill(0);
  const beginprice: number[] = new Array(n).fill(0);
  const boxArr: number[] = new Array(n).fill(0);

  // Initialize first bar
  const initBox = cfg.mode === 'ATR' ? (atrArr[0] || cfg.boxSize) : cfg.boxSize;
  boxArr[0] = initBox;
  beginprice[0] = Math.floor(bars[0].open / initBox) * initBox;

  for (let i = 0; i < n; i++) {
    const prevTrend = i > 0 ? trend[i - 1] : 0;
    const prevBegin = i > 0 ? beginprice[i - 1] : beginprice[0];
    const prevIopen = i > 0 ? iopenprice[i - 1] : 0;
    const prevIclose = i > 0 ? icloseprice[i - 1] : 0;
    const prevBox = i > 0 ? boxArr[i - 1] : initBox;

    let box = prevBox;
    let bp = prevBegin;
    let tr = prevTrend;
    let iop = 0;
    let icp = 0;

    const atrBoxSize = atrArr[i] || cfg.boxSize;
    const currentprice = cfg.source === 'close' ? bars[i].close : (tr === 1 ? bars[i].high : bars[i].low);

    if (tr === 0 && box * reversal <= Math.abs(bp - currentprice)) {
      if (bp > currentprice) {
        const numcell = Math.floor(Math.abs(bp - currentprice) / box);
        iop = bp;
        icp = bp - numcell * box;
        tr = -1;
      }
      if (bp < currentprice) {
        const numcell = Math.floor(Math.abs(bp - currentprice) / box);
        iop = bp;
        icp = bp + numcell * box;
        tr = 1;
      }
    }

    if (tr === -1) {
      let nok = true;
      if (bp > currentprice && box <= Math.abs(bp - currentprice)) {
        const numcell = Math.floor(Math.abs(bp - currentprice) / box);
        icp = bp - numcell * box;
        tr = -1;
        bp = icp;
        nok = false;
      } else {
        iop = iop === 0 ? prevIopen : iop;
        icp = icp === 0 ? prevIclose : icp;
      }

      const tempcurrentprice = cfg.source === 'close' ? bars[i].close : bars[i].high;
      if (bp < tempcurrentprice && box * reversal <= Math.abs(bp - tempcurrentprice) && nok) {
        const numcell = Math.floor(Math.abs(bp - tempcurrentprice) / box);
        iop = bp + box;
        icp = bp + numcell * box;
        tr = 1;
        bp = icp;
      } else {
        iop = iop === 0 ? prevIopen : iop;
        icp = icp === 0 ? prevIclose : icp;
      }
    } else if (tr === 1) {
      let nok = true;
      if (bp < currentprice && box <= Math.abs(bp - currentprice)) {
        const numcell = Math.floor(Math.abs(bp - currentprice) / box);
        icp = bp + numcell * box;
        tr = 1;
        bp = icp;
        nok = false;
      } else {
        iop = iop === 0 ? prevIopen : iop;
        icp = icp === 0 ? prevIclose : icp;
      }

      const tempcurrentprice = cfg.source === 'close' ? bars[i].close : bars[i].low;
      if (bp > tempcurrentprice && box * reversal <= Math.abs(bp - tempcurrentprice) && nok) {
        const numcell = Math.floor(Math.abs(bp - tempcurrentprice) / box);
        iop = bp - box;
        icp = bp - numcell * box;
        tr = -1;
        bp = icp;
      } else {
        iop = iop === 0 ? prevIopen : iop;
        icp = icp === 0 ? prevIclose : icp;
      }
    }

    // Recalculate box size if icloseprice changed
    if (i > 0 && icp !== prevIclose) {
      box = cfg.mode === 'ATR' ? atrBoxSize : cfg.boxSize;
    }

    trend[i] = tr;
    iopenprice[i] = iop;
    icloseprice[i] = icp;
    beginprice[i] = bp;
    boxArr[i] = box;
  }

  // Compute oprice (open price for area display)
  const oprice: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const prevTrend = i > 0 ? trend[i - 1] : 0;
    const prevIclose = i > 0 ? icloseprice[i - 1] : 0;
    const prevBox = i > 0 ? boxArr[i - 1] : boxArr[0];

    let op: number;
    if (trend[i] === 1) {
      op = prevTrend === 1 ? prevIclose - prevBox : prevIclose + prevBox;
    } else if (trend[i] === -1) {
      op = prevTrend === -1 ? prevIclose + prevBox : prevIclose - prevBox;
    } else {
      op = prevIclose;
    }
    oprice[i] = Math.max(op, 0);
  }

  // Breakout detection
  const botrend: number[] = new Array(n).fill(0);
  const switchArr: number[] = new Array(n).fill(0);
  {
    // Simplified breakout: detect when trend changes and brick count meets Length
    for (let i = 1; i < n; i++) {
      const brickHigh = trend[i] === 1 && icloseprice[i] > iopenprice[i];
      const brickLow = trend[i] === -1 && icloseprice[i] < iopenprice[i];

      let setA = 0, setB = 0;
      if (brickHigh && switchArr[i - 1] === 0) {
        switchArr[i] = 1;
        setA = 1;
      } else if (brickLow && switchArr[i - 1] === 1) {
        switchArr[i] = 0;
        setB = 1;
      } else {
        switchArr[i] = switchArr[i - 1];
      }

      botrend[i] = setA === 1 ? 1 : setB === 1 ? -1 : botrend[i - 1];
    }
  }

  // Main trend using EMA-based supertrend logic
  const mtrend: number[] = new Array(n).fill(1);
  const trendUp: number[] = new Array(n).fill(0);
  const trendDown: number[] = new Array(n).fill(0);
  const waitit: number[] = new Array(n).fill(0);

  // Simple EMA of icloseprice for trend estimation
  const icloseSeries = Series.fromArray(bars, icloseprice);
  const temaArr = ta.ema(icloseSeries, cfg.trendEmaLength).toArray();

  for (let i = 1; i < n; i++) {
    const box = boxArr[i];
    const icp = icloseprice[i];
    const prevIcp = icloseprice[i - 1];
    const tema = temaArr[i] || icp;
    const icpChanged = icp !== prevIcp;

    // Compute Upt and Dnt from tema
    let upt = tema - cfg.trendThreshold * box;
    upt = upt > icp - reversal * box ? icp - reversal * box : upt;
    let dnt = tema + cfg.trendThreshold * box;
    dnt = dnt < icp + reversal * box ? icp + reversal * box : dnt;

    // TrendUp / TrendDown ratcheting
    if (icpChanged && waitit[i - 1] === 0) {
      trendUp[i] = prevIcp > trendUp[i - 1] ? Math.max(upt, trendUp[i - 1]) : upt;
      trendDown[i] = prevIcp < trendDown[i - 1] ? Math.min(dnt, trendDown[i - 1]) : dnt;
    } else {
      trendUp[i] = trendUp[i - 1];
      trendDown[i] = trendDown[i - 1];
    }

    // Prevent adverse ratcheting
    if (mtrend[i - 1] === 1 && trendUp[i] < trendUp[i - 1]) trendUp[i] = trendUp[i - 1];
    if (mtrend[i - 1] === -1 && trendDown[i] > trendDown[i - 1]) trendDown[i] = trendDown[i - 1];

    // Direction
    let mt = waitit[i - 1] === 0
      ? (icp > trendDown[i - 1] ? 1 : icp < trendUp[i - 1] ? -1 : mtrend[i - 1])
      : mtrend[i - 1];

    // Whipsaw wait logic
    let wi = 0;
    if (mt !== mtrend[i - 1] && waitit[i - 1] === 0 && (i < 2 || waitit[i - 2] === 0)) {
      wi = 1;
    } else {
      wi = waitit[i - 1] !== 0 ? waitit[i - 1] + 1 : 0;
    }

    if (wi > 0) mt = mtrend[i - 1];

    if (wi > cfg.barcountWhip) {
      if (mt === 1) {
        if (icp >= trendUp[i] + cfg.trendThresholdReversal * box) wi = 0;
        if (icp <= trendUp[i] - cfg.trendThresholdReversal * box) {
          wi = 0;
          mt = -1;
          trendDown[i] = prevIcp < trendDown[i - 1] ? Math.min(dnt, trendDown[i - 1]) : dnt;
        }
      } else {
        if (icp <= trendDown[i] - cfg.trendThresholdReversal * box) wi = 0;
        if (icp >= trendDown[i] + cfg.trendThresholdReversal * box) {
          wi = 0;
          mt = 1;
          trendUp[i] = prevIcp > trendUp[i - 1] ? Math.max(upt, trendUp[i - 1]) : upt;
        }
      }
    }

    mtrend[i] = mt;
    waitit[i] = wi;
  }

  // Build output plots
  const warmup = cfg.atrPeriod;
  const upColor = '#0000FF';   // blue for up (Blue/Red theme default)
  const downColor = '#FF0000'; // red for down

  const openPlot = oprice.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v <= 0 ? NaN : v,
    color: '#808080',
  }));

  const closePlot = icloseprice.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v <= 0 ? NaN : v,
    color: '#808080',
  }));

  // Breakout line
  const breakoutPlot = bars.map((b, i) => {
    if (i < warmup || !cfg.showBreakout) return { time: b.time, value: NaN };
    const val = botrend[i] === 1
      ? (trend[i] === 1 ? icloseprice[i] : oprice[i])
      : (trend[i] === 1 ? oprice[i] : icloseprice[i]);
    return {
      time: b.time,
      value: val <= 0 ? NaN : val,
      color: botrend[i] === 1 ? '#00FF00' : botrend[i] === -1 ? '#FF0000' : 'transparent',
    };
  });

  // Trend line
  const tsl = mtrend.map((mt, i) => mt === 1 ? trendUp[i] : trendDown[i]);
  const trendPlot = tsl.map((v, i) => {
    if (i < warmup || !cfg.showTrend || v === 0 || (i > 0 && tsl[i - 1] === 0)) {
      return { time: bars[i].time, value: NaN };
    }
    let color: string;
    const prevMt = i > 0 ? mtrend[i - 1] : mtrend[i];
    if (mtrend[i] === 1 && prevMt === 1) {
      color = waitit[i] === 0 ? '#008000' : '#C0C0C0';
    } else if (mtrend[i] === -1 && prevMt === -1) {
      color = waitit[i] === 0 ? '#FF0000' : '#C0C0C0';
    } else {
      color = 'transparent';
    }
    return { time: bars[i].time, value: v, color };
  });

  // Fill between open and close with trend color
  const fillColors = bars.map((_b, i) => {
    if (i < warmup || oprice[i] <= 0 || icloseprice[i] <= 0) return 'transparent';
    return trend[i] === 1 ? 'rgba(0,0,255,0.30)' : 'rgba(255,0,0,0.30)';
  });

  // Bar colors
  const barColors: BarColorData[] = [];
  if (cfg.changeBarCol) {
    for (let i = warmup; i < n; i++) {
      barColors.push({
        time: bars[i].time,
        color: trend[i] === 1 ? upColor : downColor,
      });
    }
  }

  // Markers for trend direction changes
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (mtrend[i] !== mtrend[i - 1] && cfg.showTrend) {
      if (mtrend[i] === 1) {
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'circle',
          color: '#008000',
          text: 'Up',
        });
      } else {
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'circle',
          color: '#FF0000',
          text: 'Down',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'renkoOpen': openPlot,
      'renkoClose': closePlot,
      'breakoutLine': breakoutPlot,
      'trendLine': trendPlot,
    },
    fills: [
      { plot1: 'renkoOpen', plot2: 'renkoClose', options: { color: 'rgba(0,0,255,0.30)' }, colors: fillColors },
    ],
    markers,
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const RenkoChart = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
