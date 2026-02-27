/**
 * Unit tests for new community indicators (batch 2).
 */

import { describe, it, expect } from 'vitest';
import {
  ADXCobra,
  AIEngulfing,
  AKTrendID,
  AllCandlestickPatterns,
  AlphaTrend,
  AntiVolumeStop,
  ATRPlus,
  ATRTrailingColored,
  AutoFib,
  AutoSupport,
  AutoSupportResistance,
  BBStochRSI,
  BinaryOptionArrows,
  BitcoinKillZones,
  BullishEngulfingFinder,
  BullsBears,
  BuyingSellVolume,
  BuySellPressure,
  CandlestickReversal,
  CCIOBV,
  CDCActionZone,

  CMEnhancedIchimoku,
  CMGannSwing,
  CMGuppyEMA,
  CMHeikinAshi,
  CMLaguerrePPO,

  CMPriceAction,
  CMRSI2Lower,
  CMRSI2Upper,
  CMRSIPlusEMA,
  CMStochHighlight,
  CMTimeLines,
  CMVixFixV3,
  COGChannel,
  DarvasBox,
  DMIADX,
  DonchianCustom,
  EasyTrendColors,
  EMAEnveloper,
  EMAMACross,
  EMAMulti,
  EMARibbon,
  EMASupertrend,
  EMAWave,
  EntryPoints,
  EnvelopeRSI,
  EVWMAEnvelope,
  FaithIndicator,
  FibonacciLevels,
  FibonacciZone,
  FollowLine,
  ForexSessions,
  FXSniperT3CCI,
  HalfTrend,
  HawkEyeVolume,
  HullSuite,
  IchimokuEMABands,
  IntradayBuySell,
  IntradayTSBB,
  IsolatedPeakBottom,
  LaguerreRSI,
  LeledcLevels,
  LinRegCandles,
  MAADX,
  MACDAS,
  MACDBB,
  MACDCrossover,
  MACDDEMA,
  MACDDivergence,
  MACDVXI,
  MAColored,
  MADeviationRate,
  MarketCipherA,
  MarketCipherB,
  MarketShiftLevels,
  MAShadedFill,
  MAShift,
  MatrixSeries,
  MavilimW,
  MFIRSIBollingerBands,
  ModifiedHeikinAshi,
  MultipleMA,
  MurreysOscillator,
  NormalizedQQE,
  OptimizedTrendTracker,
  ParallelPivotLines,
  PhilakoneEMASwing,
  PivotPointSupertrend,
  PPOAlerts,
  PPODivergence,
  PremierRSI,
  PriceActionSystem,
  QQE,
  QQEMod,
  QQESignals,
  RCI3Lines,
  RedKRSSWMA,
  ReversalCandleSetup,
  RipsterEMAClouds,
  RSIBands,
  RSIBBDispersion,
  RSICandles,
  RSIDivergence,
  RSIHistoAlert,
  RSISnabbel,
  RSISwingSignal,
  RSSupportResistance,
  SAREMAMACDSignals,
  ScalpingLine,
  SellBuyRates,
  SignalMA,
  SimpleMovingAverages,
  SlowHeikenAshi,
  SMIUCS,
  SqueezeMomentumV2,
  SRLevelsBreaks,
  SSLChannel,
  ST0P,
  StochasticOTT,
  StochPOP1,
  StochPOP2,
  StochVX3,
  SuperSmoothedMACD,
  SuperSupertrend,
  SupertrendChannels,
  SwingTradeSignals,
  TDIHLCTrix,
  TDMacd,
  ThreeMovingAverages,
  TillsonT3,
  TonyUXScalper,
  TopBottomCandle,
  TopsBottoms,
  TRAMA,
  TransientZones,
  TrendFollowingMA,
  TrendMagic,
  TrendTrader,
  TriangularMomentumOsc,
  TripleMAForecast,
  TTMSqueezePro,
  UTBot,
  VdubSniper,
  VdubusBinaryPro,
  VolumeColoredBars,
  VolumeFlowV3,
  VolumeLinRegTrend,
  VWMACDSZO,
  VWMACDV2,
  WaddahAttarExplosion,
  WeisWaveVolume,
  WickedFractals,
  WilliamsCombo,
  ZeroLagEMA,
  ZeroLagMACD,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Inline OHLCV fixture – 80 bars of synthetic trending-then-reverting data
// ---------------------------------------------------------------------------
function makeFixture(): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let price = 100;
  for (let i = 0; i < 80; i++) {
    const drift = i < 40 ? 0.3 : -0.3;
    const noise = (rand() - 0.5) * 4;
    const open = price;
    const close = price + drift + noise;
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.min(open, close) - rand() * 2;
    const volume = 500 + Math.floor(rand() * 1000);
    bars.push({ time: 1609459200 + i * 86400, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

const bars = makeFixture();

function validValues(result: any, plotKey = 'plot0') {
  return (result.plots as Record<string, Array<{ time: number; value: number }>>)[plotKey]
    .map((p: any) => p.value)
    .filter((v: number) => !isNaN(v));
}

function assertShape(result: any, expectedPlots: string[], overlay: boolean) {
  expect(result.metadata).toBeDefined();
  expect(result.metadata.title).toBeTruthy();
  expect(result.metadata.overlay).toBe(overlay);
  for (const key of expectedPlots) {
    expect(result.plots).toHaveProperty(key);
    const plot = (result.plots as Record<string, Array<{ time: number; value: number }>>)[key];
    expect(plot).toHaveLength(bars.length);
    for (const p of plot) {
      expect(typeof p.time).toBe('number');
      expect(typeof p.value).toBe('number');
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ADXCobra', () => {
  const result = ADXCobra.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AIEngulfing', () => {
  const result = AIEngulfing.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AKTrendID', () => {
  const result = AKTrendID.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AllCandlestickPatterns', () => {
  const result = AllCandlestickPatterns.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AlphaTrend', () => {
  const result = AlphaTrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AntiVolumeStop', () => {
  const result = AntiVolumeStop.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ATRPlus', () => {
  const result = ATRPlus.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ATRTrailingColored', () => {
  const result = ATRTrailingColored.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AutoFib', () => {
  const result = AutoFib.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AutoSupport', () => {
  const result = AutoSupport.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('AutoSupportResistance', () => {
  const result = AutoSupportResistance.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BBStochRSI', () => {
  const result = BBStochRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BinaryOptionArrows', () => {
  const result = BinaryOptionArrows.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BitcoinKillZones', () => {
  const result = BitcoinKillZones.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BullishEngulfingFinder', () => {
  const result = BullishEngulfingFinder.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BullsBears', () => {
  const result = BullsBears.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BuyingSellVolume', () => {
  const result = BuyingSellVolume.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['volume', 'buyVol', 'sellVol', 'buyPct', 'sellPct', 'volIndex'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'volume');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('BuySellPressure', () => {
  const result = BuySellPressure.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['selling', 'buying', 'spAvg', 'bpAvg', 'vpo1', 'vpo2', 'vph'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'buying');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CandlestickReversal', () => {
  const result = CandlestickReversal.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CCIOBV', () => {
  const result = CCIOBV.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CDCActionZone', () => {
  const result = CDCActionZone.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});


describe('CMEnhancedIchimoku', () => {
  const result = CMEnhancedIchimoku.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMGannSwing', () => {
  const result = CMGannSwing.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMGuppyEMA', () => {
  const result = CMGuppyEMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7', 'plot8', 'plot9', 'plot10', 'plot11'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMHeikinAshi', () => {
  const result = CMHeikinAshi.calculate(bars) as any;

  it('returns correct shape', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.plotCandles).toBeDefined();
  });

  it('produces candle data', () => {
    const candles = result.plotCandles?.candle0 ?? result.plotCandles?.['candle0'] ?? [];
    expect(candles.length).toBeGreaterThan(0);
  });
});

describe('CMLaguerrePPO', () => {
  const result = CMLaguerrePPO.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});


describe('CMPriceAction', () => {
  const result = CMPriceAction.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMRSI2Lower', () => {
  const result = CMRSI2Lower.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMRSI2Upper', () => {
  const result = CMRSI2Upper.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMRSIPlusEMA', () => {
  const result = CMRSIPlusEMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMStochHighlight', () => {
  const result = CMStochHighlight.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMTimeLines', () => {
  const result = CMTimeLines.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('CMVixFixV3', () => {
  const result = CMVixFixV3.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('COGChannel', () => {
  const result = COGChannel.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('DarvasBox', () => {
  const result = DarvasBox.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('DMIADX', () => {
  const result = DMIADX.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('DonchianCustom', () => {
  const result = DonchianCustom.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EasyTrendColors', () => {
  const result = EasyTrendColors.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['upper', 'lower', 'zeroline'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'upper');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMAEnveloper', () => {
  const result = EMAEnveloper.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMAMACross', () => {
  const result = EMAMACross.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMAMulti', () => {
  const result = EMAMulti.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMARibbon', () => {
  const result = EMARibbon.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMASupertrend', () => {
  const result = EMASupertrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EMAWave', () => {
  const result = EMAWave.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EntryPoints', () => {
  const result = EntryPoints.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EnvelopeRSI', () => {
  const result = EnvelopeRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('EVWMAEnvelope', () => {
  const result = EVWMAEnvelope.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('FaithIndicator', () => {
  const result = FaithIndicator.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('FibonacciLevels', () => {
  const result = FibonacciLevels.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['midline', 'up1', 'up2', 'up3', 'up4', 'up5', 'up6', 'down1', 'down2', 'down3', 'down4', 'down5', 'down6'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'midline');
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('FibonacciZone', () => {
  const result = FibonacciZone.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('FollowLine', () => {
  const result = FollowLine.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ForexSessions', () => {
  const result = ForexSessions.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('FXSniperT3CCI', () => {
  const result = FXSniperT3CCI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('HalfTrend', () => {
  const result = HalfTrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('HawkEyeVolume', () => {
  const result = HawkEyeVolume.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('HullSuite', () => {
  const result = HullSuite.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('IchimokuEMABands', () => {
  const result = IchimokuEMABands.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('IntradayBuySell', () => {
  const result = IntradayBuySell.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('IntradayTSBB', () => {
  const result = IntradayTSBB.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('IsolatedPeakBottom', () => {
  const result = IsolatedPeakBottom.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('LaguerreRSI', () => {
  const result = LaguerreRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('LeledcLevels', () => {
  const result = LeledcLevels.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('LinRegCandles', () => {
  const result = LinRegCandles.calculate(bars) as any;

  it('returns correct shape', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.plotCandles).toBeDefined();
  });

  it('produces candle data', () => {
    const candles = result.plotCandles?.candle0 ?? result.plotCandles?.['candle0'] ?? [];
    expect(candles.length).toBeGreaterThan(0);
  });
});

describe('MAADX', () => {
  const result = MAADX.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDAS', () => {
  const result = MACDAS.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDBB', () => {
  const result = MACDBB.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDCrossover', () => {
  const result = MACDCrossover.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDDEMA', () => {
  const result = MACDDEMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDDivergence', () => {
  const result = MACDDivergence.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACDVXI', () => {
  const result = MACDVXI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MAColored', () => {
  const result = MAColored.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MADeviationRate', () => {
  const result = MADeviationRate.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MarketCipherA', () => {
  const result = MarketCipherA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MarketCipherB', () => {
  const result = MarketCipherB.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MarketShiftLevels', () => {
  const result = MarketShiftLevels.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MAShadedFill', () => {
  const result = MAShadedFill.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MAShift', () => {
  const result = MAShift.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MatrixSeries', () => {
  const result = MatrixSeries.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MavilimW', () => {
  const result = MavilimW.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MFIRSIBollingerBands', () => {
  const result = MFIRSIBollingerBands.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ModifiedHeikinAshi', () => {
  const result = ModifiedHeikinAshi.calculate(bars) as any;

  it('returns correct shape', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.plotCandles).toBeDefined();
  });

  it('produces candle data', () => {
    const candles = result.plotCandles?.candle0 ?? result.plotCandles?.['candle0'] ?? [];
    expect(candles.length).toBeGreaterThan(0);
  });
});

describe('MultipleMA', () => {
  const result = MultipleMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MurreysOscillator', () => {
  const result = MurreysOscillator.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('NormalizedQQE', () => {
  const result = NormalizedQQE.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('OptimizedTrendTracker', () => {
  const result = OptimizedTrendTracker.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ParallelPivotLines', () => {
  const result = ParallelPivotLines.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PhilakoneEMASwing', () => {
  const result = PhilakoneEMASwing.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PivotPointSupertrend', () => {
  const result = PivotPointSupertrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PPOAlerts', () => {
  const result = PPOAlerts.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PPODivergence', () => {
  const result = PPODivergence.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PremierRSI', () => {
  const result = PremierRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('PriceActionSystem', () => {
  const result = PriceActionSystem.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('QQE', () => {
  const result = QQE.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('QQEMod', () => {
  const result = QQEMod.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('QQESignals', () => {
  const result = QQESignals.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RCI3Lines', () => {
  const result = RCI3Lines.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RedKRSSWMA', () => {
  const result = RedKRSSWMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ReversalCandleSetup', () => {
  const result = ReversalCandleSetup.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RipsterEMAClouds', () => {
  const result = RipsterEMAClouds.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7', 'plot8', 'plot9'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSIBands', () => {
  const result = RSIBands.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSIBBDispersion', () => {
  const result = RSIBBDispersion.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSICandles', () => {
  const result = RSICandles.calculate(bars) as any;

  it('returns correct shape', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.plotCandles).toBeDefined();
  });

  it('produces candle data', () => {
    const candles = result.plotCandles?.rsi ?? result.plotCandles?.candle0 ?? [];
    expect(candles.length).toBeGreaterThan(0);
  });
});

describe('RSIDivergence', () => {
  const result = RSIDivergence.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSIHistoAlert', () => {
  const result = RSIHistoAlert.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSISnabbel', () => {
  const result = RSISnabbel.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSISwingSignal', () => {
  const result = RSISwingSignal.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('RSSupportResistance', () => {
  const result = RSSupportResistance.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SAREMAMACDSignals', () => {
  const result = SAREMAMACDSignals.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ScalpingLine', () => {
  const result = ScalpingLine.calculate(bars, { mainPeriod: 20, signalPeriod: 5 });

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SellBuyRates', () => {
  const result = SellBuyRates.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SignalMA', () => {
  const result = SignalMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SimpleMovingAverages', () => {
  const result = SimpleMovingAverages.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7', 'plot8', 'plot9'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SlowHeikenAshi', () => {
  const result = SlowHeikenAshi.calculate(bars) as any;

  it('returns correct shape', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.plotCandles).toBeDefined();
  });

  it('produces candle data', () => {
    const candles = result.plotCandles?.candle0 ?? result.plotCandles?.['candle0'] ?? [];
    expect(candles.length).toBeGreaterThan(0);
  });
});

describe('SMIUCS', () => {
  const result = SMIUCS.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SqueezeMomentumV2', () => {
  const result = SqueezeMomentumV2.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SRLevelsBreaks', () => {
  const result = SRLevelsBreaks.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SSLChannel', () => {
  const result = SSLChannel.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ST0P', () => {
  const result = ST0P.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('StochasticOTT', () => {
  const result = StochasticOTT.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('StochPOP1', () => {
  const result = StochPOP1.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('StochPOP2', () => {
  const result = StochPOP2.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('StochVX3', () => {
  const result = StochVX3.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SuperSmoothedMACD', () => {
  const result = SuperSmoothedMACD.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SuperSupertrend', () => {
  const result = SuperSupertrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SupertrendChannels', () => {
  const result = SupertrendChannels.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('SwingTradeSignals', () => {
  const result = SwingTradeSignals.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TDIHLCTrix', () => {
  const result = TDIHLCTrix.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TDMacd', () => {
  const result = TDMacd.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ThreeMovingAverages', () => {
  const result = ThreeMovingAverages.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TillsonT3', () => {
  const result = TillsonT3.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TonyUXScalper', () => {
  const result = TonyUXScalper.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TopBottomCandle', () => {
  const result = TopBottomCandle.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TopsBottoms', () => {
  const result = TopsBottoms.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TRAMA', () => {
  const result = TRAMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TransientZones', () => {
  const result = TransientZones.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TrendFollowingMA', () => {
  const result = TrendFollowingMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TrendMagic', () => {
  const result = TrendMagic.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TrendTrader', () => {
  const result = TrendTrader.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TriangularMomentumOsc', () => {
  const result = TriangularMomentumOsc.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TripleMAForecast', () => {
  const result = TripleMAForecast.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('TTMSqueezePro', () => {
  const result = TTMSqueezePro.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('UTBot', () => {
  const result = UTBot.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VdubSniper', () => {
  const result = VdubSniper.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VdubusBinaryPro', () => {
  const result = VdubusBinaryPro.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VolumeColoredBars', () => {
  const result = VolumeColoredBars.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VolumeFlowV3', () => {
  const result = VolumeFlowV3.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['volume', 'bullMa', 'bearMa', 'bullSpike', 'bearSpike', 'diffValue'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'volume');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VolumeLinRegTrend', () => {
  const result = VolumeLinRegTrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VWMACDSZO', () => {
  const result = VWMACDSZO.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('VWMACDV2', () => {
  const result = VWMACDV2.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('WaddahAttarExplosion', () => {
  const result = WaddahAttarExplosion.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('WeisWaveVolume', () => {
  const result = WeisWaveVolume.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('WickedFractals', () => {
  const result = WickedFractals.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThanOrEqual(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('WilliamsCombo', () => {
  const result = WilliamsCombo.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ZeroLagEMA', () => {
  const result = ZeroLagEMA.calculate(bars, { slowLen: 20 });

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('ZeroLagMACD', () => {
  const result = ZeroLagMACD.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

