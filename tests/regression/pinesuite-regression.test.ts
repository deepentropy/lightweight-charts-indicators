/**
 * PineSuite Regression Tests for Optimized Indicators
 *
 * This test suite validates optimized indicators from lightweight-charts-indicators
 * against reference data from the private deepentropy/pinesuite repository.
 *
 * Indicators are dynamically loaded from the package exports.
 * Add an indicator to indicator-mapping.json and export it from src/index.ts
 * to have it automatically tested.
 */

import { afterAll, describe, expect, it, test } from 'vitest';
import { fetchPineSuiteCSV, hasPineSuiteToken } from './utils/pinesuite-fetcher.js';
import { parseCSV } from './utils/csv-parser.js';
import { compareArrays, formatComparisonResult } from './utils/comparison.js';
import indicatorMapping from './indicator-mapping.json' with { type: 'json' };

// Import the indicators package - indicators are exported by name
import * as indicators from '../../src/index.js';

// Test configuration
const TOLERANCE = 2e-6;
const SKIP_INITIAL_VALUES = 100;

interface IndicatorConfig {
  dataFile: string;
  exportName: string;
  normalize?: boolean | 'offset' | 'pctChange';
  skipInitial?: number;
  tolerance?: number;
  skipTest?: boolean;
  skipReason?: string;
}

interface IndicatorMapping {
  [indicatorName: string]: IndicatorConfig;
}

interface PlotData {
  time: string | number;
  value: number | null | undefined;
}

interface IndicatorResult {
  metadata?: any;
  plots: Record<string, PlotData[]>;
}

type CalculateFn = (bars: any[], inputs: any) => IndicatorResult;

interface IndicatorExport {
  calculate?: CalculateFn;
  default?: CalculateFn;
  plotConfig?: any[];
}

const mapping = indicatorMapping as IndicatorMapping;

// Test result tracking
interface TestResult {
  indicator: string;
  status: 'passed' | 'failed' | 'skipped';
  maxDiff?: number;
  plotCount?: number;
  totalPlotCount?: number;
  csvColumns?: number;
  failedOutputs?: Array<{ name: string; reason: string }>;
  caveats?: string[];
  skipReason?: string;
}

const testResults: TestResult[] = [];

/**
 * Get an indicator from the package exports
 */
function getIndicator(exportName: string): IndicatorExport | null {
  const indicator = (indicators as Record<string, any>)[exportName];
  if (!indicator) {
    return null;
  }
  return indicator;
}

describe('PineSuite Regression Tests - Optimized Indicators', () => {
  // Skip all tests if PINESUITE_TOKEN is not set
  if (!hasPineSuiteToken()) {
    console.warn('\n  PINESUITE_TOKEN environment variable is not set. Skipping PineSuite regression tests.\n');
    it.skip('requires PINESUITE_TOKEN to be set', () => {});
    return;
  }

  describe('Optimized Indicators', () => {
    // Handle empty mapping
    const mappingEntries = Object.entries(mapping).filter(([key]) => !key.startsWith('_'));

    if (mappingEntries.length === 0) {
      it('no indicators configured - add indicators to indicator-mapping.json', () => {
        console.log('\n  No indicators in mapping. Add indicators to indicator-mapping.json to run tests.\n');
        expect(true).toBe(true);
      });
      return;
    }

    // Filter to only indicators that are actually implemented
    const implementedIndicators = mappingEntries.filter(([, config]) => {
      const indicatorExport = getIndicator(config.exportName);
      const calculateFn = indicatorExport?.calculate || indicatorExport?.default;
      return typeof calculateFn === 'function';
    });

    if (implementedIndicators.length === 0) {
      it('no indicators implemented yet - export indicators from src/index.ts to test them', () => {
        console.log('\n  No indicators exported from lightweight-charts-indicators yet.');
        console.log('  Export an indicator from src/index.ts to have it tested.\n');
        expect(true).toBe(true);
      });
      return;
    }

    for (const [indicatorId, config] of implementedIndicators) {
      // Skip tests marked with skipTest flag
      if (config.skipTest) {
        it.skip(`${indicatorId} (${config.exportName}) should match PineSuite reference data - ${config.skipReason || 'skipped'}`, () => {
          testResults.push({
            indicator: indicatorId,
            status: 'skipped',
            skipReason: config.skipReason || 'skipTest flag set',
          });
        });
        continue;
      }

      it(`${indicatorId} (${config.exportName}) should match PineSuite reference data`, async () => {
        // Re-fetch indicator inside the test to avoid closure issues
        const indicatorMod = getIndicator(config.exportName)!;
        const calcFn = (indicatorMod.calculate || indicatorMod.default)!;

        // Fetch CSV data from pinesuite
        let csvContent: string;
        try {
          csvContent = await fetchPineSuiteCSV(config.dataFile);
        } catch (error) {
          throw new Error(`Failed to fetch ${config.dataFile}: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Parse CSV data
        const referenceData = parseCSV(csvContent);
        if (referenceData.length === 0) {
          throw new Error(`No data found in ${config.dataFile}`);
        }

        // Convert to bar format
        const bars = referenceData.map(row => ({
          time: row.time,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume || 0,
        }));

        // Determine output columns
        const standardColumns = new Set(['time', 'open', 'high', 'low', 'close', 'volume']);
        const firstRow = referenceData[0];
        const outputColumns = Object.keys(firstRow).filter(col => !standardColumns.has(col.toLowerCase()));

        if (outputColumns.length === 0) {
          throw new Error(`No output columns found in ${config.dataFile}`);
        }

        // Calculate indicator with default inputs
        const result: IndicatorResult = calcFn(bars, {});

        if (!result || !result.plots) {
          throw new Error(`Indicator ${indicatorId} did not return valid result with plots`);
        }

        // Get plot outputs - filter out inactive plots
        const allPlotKeys = Object.keys(result.plots).sort();
        const plotConfig = indicatorMod.plotConfig || [];
        const plotKeys = allPlotKeys.filter(key => {
          const plotData: PlotData[] = result.plots[key];
          const cfg = plotConfig.find((p: any) => p.id === key);
          if (cfg?.display === 'none') {
            return false;
          }
          return plotData.some(p =>
            p.value !== undefined && p.value !== null && !Number.isNaN(p.value)
          );
        });

        if (plotKeys.length !== outputColumns.length) {
          console.warn(`    Plot count mismatch: ${indicatorId} has ${plotKeys.length} active plots (${allPlotKeys.length} total) but CSV has ${outputColumns.length} output columns`);
        }

        // Compare each output
        const results: Record<string, any> = {};
        let allPassed = true;
        let maxDiff = 0;

        for (let i = 0; i < Math.min(plotKeys.length, outputColumns.length); i++) {
          const plotKey = plotKeys[i];
          const columnName = outputColumns[i];

          const plotData: PlotData[] = result.plots[plotKey];
          const actualValues = plotData.map((p) => p.value);

          const expectedValues = referenceData.map(row => {
            const value = row[columnName];
            return typeof value === 'number' ? value : null;
          });

          const skipCount = config.skipInitial ?? SKIP_INITIAL_VALUES;
          const tolerance = config.tolerance ?? TOLERANCE;
          const comparisonResult = compareArrays(
            actualValues,
            expectedValues,
            tolerance,
            skipCount,
            config.normalize ?? false
          );

          results[columnName] = comparisonResult;

          if (!comparisonResult.passed) {
            allPassed = false;
          }

          if (comparisonResult.maxDiff !== undefined && comparisonResult.maxDiff > maxDiff) {
            maxDiff = comparisonResult.maxDiff;
          }

          console.log(`  ${formatComparisonResult(`${indicatorId}[${columnName}]`, comparisonResult)}`);
        }

        if (!allPassed) {
          const failedOutputs = Object.entries(results)
            .filter(([, result]) => !result.passed)
            .map(([name, result]) => ({
              name,
              reason: result.failureCount ? `${result.failureCount} values exceeded tolerance` : 'comparison failed'
            }));

          console.log(`\n  ${indicatorId}: ${failedOutputs.length} output(s) failed: ${failedOutputs.map(o => o.name).join(', ')}\n`);

          for (const [name, result] of Object.entries(results)) {
            if (!result.passed) {
              console.log(formatComparisonResult(`${indicatorId}[${name}]`, result, true));
            }
          }

          testResults.push({
            indicator: indicatorId,
            status: 'failed',
            plotCount: plotKeys.length,
            totalPlotCount: allPlotKeys.length,
            csvColumns: outputColumns.length,
            failedOutputs,
          });

          expect(allPassed).toBe(true);
        } else {
          const caveats: string[] = [];
          if (config.normalize) {
            caveats.push('normalized (comparing relative changes, not absolute values)');
          }
          if (config.skipInitial && config.skipInitial > SKIP_INITIAL_VALUES) {
            caveats.push(`extended warmup (skipping ${config.skipInitial} bars instead of ${SKIP_INITIAL_VALUES})`);
          }

          if (caveats.length > 0) {
            console.log(`    ${indicatorId}: All ${outputColumns.length} output(s) passed WITH CAVEATS:`);
            for (const caveat of caveats) {
              console.log(`      - ${caveat}`);
            }
            console.log('');
          } else {
            console.log(`  ${indicatorId}: All ${outputColumns.length} output(s) passed\n`);
          }

          testResults.push({
            indicator: indicatorId,
            status: 'passed',
            maxDiff,
            plotCount: plotKeys.length,
            totalPlotCount: allPlotKeys.length,
            csvColumns: outputColumns.length,
            caveats: caveats.length > 0 ? caveats : undefined,
          });
        }
      });
    }
  });

  afterAll(() => {
    const passedClean = testResults.filter(r => r.status === 'passed' && !r.caveats);
    const passedWithCaveats = testResults.filter(r => r.status === 'passed' && r.caveats);
    const failed = testResults.filter(r => r.status === 'failed');
    const skipped = testResults.filter(r => r.status === 'skipped');

    console.log('\n');
    console.log('===================================================================');
    console.log('        OPTIMIZED INDICATORS REGRESSION TEST SUMMARY              ');
    console.log('===================================================================');
    console.log(`Total Indicators in Mapping: ${testResults.length}`);
    console.log(`Passed: ${passedClean.length}`);
    if (passedWithCaveats.length > 0) {
      console.log(`Passed with caveats: ${passedWithCaveats.length}`);
    }
    console.log(`Failed: ${failed.length}`);
    console.log(`Skipped (not implemented): ${skipped.length}`);
    console.log('-------------------------------------------------------------------');

    for (const result of testResults) {
      const hasCaveats = result.caveats && result.caveats.length > 0;
      let icon: string;
      if (result.status === 'passed') {
        icon = hasCaveats ? '[CAVEAT]' : '[PASS]';
      } else if (result.status === 'failed') {
        icon = '[FAIL]';
      } else {
        icon = '[SKIP]';
      }

      const details = result.maxDiff !== undefined ? ` (max diff: ${result.maxDiff.toExponential(2)})` : '';
      const plotInfo = result.plotCount !== undefined
        ? ` [${result.plotCount}/${result.totalPlotCount} plots, ${result.csvColumns} CSV cols]`
        : '';
      const skipInfo = result.skipReason ? ` - ${result.skipReason}` : '';

      console.log(`${icon} ${result.indicator.padEnd(20)} ${result.status.padEnd(8)}${details}${plotInfo}${skipInfo}`);

      if (result.failedOutputs && result.failedOutputs.length > 0) {
        for (const output of result.failedOutputs) {
          console.log(`     -> ${output.name}: ${output.reason}`);
        }
      }

      if (hasCaveats) {
        for (const caveat of result.caveats!) {
          console.log(`     -> ${caveat}`);
        }
      }
    }

    console.log('===================================================================');

    if (skipped.length > 0) {
      console.log('\nTo implement an indicator, export it from packages/indicators/src/index.ts');
      console.log('Example: export { SMA } from \'./sma\';');
    }
  });
});
