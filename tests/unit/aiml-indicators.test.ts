/**
 * Tests for AI/ML community indicators
 * Auto-generated
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';

function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.1) + Math.cos(i * 0.07)) * 2;
    price = Math.max(10, price + change);
    const high = price + Math.abs(Math.sin(i * 0.3)) * 3 + 0.5;
    const low = price - Math.abs(Math.cos(i * 0.3)) * 3 - 0.5;
    const open = price + (Math.sin(i * 0.5) > 0 ? 1 : -1);
    const vol = 1000 + Math.floor(Math.abs(Math.sin(i * 0.2)) * 5000);
    bars.push({ time: 1000000 + i * 86400, open, high, low, close: price, volume: vol });
  }
  return bars;
}

const bars = generateBars(300);

import { AiTrendNavigator } from '../../src/community/ai-trend-navigator';
describe('AI Trend Navigator [K-Neighbor]', () => {
  it('should return valid result structure', () => {
    const result = AiTrendNavigator.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = AiTrendNavigator.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(AiTrendNavigator.metadata.title).toBe('AI Trend Navigator [K-Neighbor]');
    expect(AiTrendNavigator.metadata.overlay).toBe(true);
  });
});

import { MlAdaptiveSupertrend } from '../../src/community/ml-adaptive-supertrend';
describe('ML Adaptive SuperTrend', () => {
  it('should return valid result structure', () => {
    const result = MlAdaptiveSupertrend.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = MlAdaptiveSupertrend.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should return table data', () => {
    const result = MlAdaptiveSupertrend.calculate(bars) as any;
    expect(result.tables).toBeDefined();
    expect(result.tables.cells.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(MlAdaptiveSupertrend.metadata.title).toBe('ML Adaptive SuperTrend');
    expect(MlAdaptiveSupertrend.metadata.overlay).toBe(true);
  });
});

import { MlKnnStrategy } from '../../src/community/ml-knn-strategy';
describe('ML: kNN Strategy', () => {
  it('should return valid result structure', () => {
    const result = MlKnnStrategy.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = MlKnnStrategy.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(MlKnnStrategy.metadata.title).toBe('ML: kNN Strategy');
    expect(MlKnnStrategy.metadata.overlay).toBe(false);
  });
});

import { MlMomentumIndex } from '../../src/community/ml-momentum-index';
describe('ML Momentum Index', () => {
  it('should return valid result structure', () => {
    const result = MlMomentumIndex.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = MlMomentumIndex.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(MlMomentumIndex.metadata.title).toBe('ML Momentum Index');
    expect(MlMomentumIndex.metadata.overlay).toBe(false);
  });
});

import { MlMovingAverage } from '../../src/community/ml-moving-average';
describe('ML Moving Average', () => {
  it('should return valid result structure', () => {
    const result = MlMovingAverage.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = MlMovingAverage.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(MlMovingAverage.metadata.title).toBe('ML Moving Average');
    expect(MlMovingAverage.metadata.overlay).toBe(true);
  });
});

import { MlRsi } from '../../src/community/ml-rsi';
describe('ML RSI', () => {
  it('should return valid result structure', () => {
    const result = MlRsi.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = MlRsi.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should return table data', () => {
    const result = MlRsi.calculate(bars) as any;
    expect(result.tables).toBeDefined();
    expect(result.tables.cells.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(MlRsi.metadata.title).toBe('ML RSI');
    expect(MlRsi.metadata.overlay).toBe(false);
  });
});

import { SupertrendAiClustering } from '../../src/community/supertrend-ai-clustering';
describe('SuperTrend AI Clustering', () => {
  it('should return valid result structure', () => {
    const result = SupertrendAiClustering.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = SupertrendAiClustering.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should return table data', () => {
    const result = SupertrendAiClustering.calculate(bars) as any;
    expect(result.tables).toBeDefined();
    expect(result.tables.cells.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(SupertrendAiClustering.metadata.title).toBe('SuperTrend AI Clustering');
    expect(SupertrendAiClustering.metadata.overlay).toBe(true);
  });
});

import { VolumeSuperTrendAi } from '../../src/community/volume-supertrend-ai';
describe('Volume SuperTrend AI', () => {
  it('should return valid result structure', () => {
    const result = VolumeSuperTrendAi.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = VolumeSuperTrendAi.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(VolumeSuperTrendAi.metadata.title).toBe('Volume SuperTrend AI');
    expect(VolumeSuperTrendAi.metadata.overlay).toBe(true);
  });
});

