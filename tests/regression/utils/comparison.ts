/**
 * Comparison utilities for indicator validation
 */

export interface ComparisonResult {
  passed: boolean;
  totalValues: number;
  validComparisons: number;
  mismatches: number;
  maxDifference: number;
  avgDifference: number;
  failedIndices?: number[];
}

/**
 * Normalize an array by subtracting its first valid value
 * Used for cumulative indicators like OBV where absolute values depend on history
 */
function normalizeArray(arr: (number | null | undefined)[]): (number | null | undefined)[] {
    // Find first valid value
    let firstValid: number | null = null;
    for (const val of arr) {
        if (val != null && !Number.isNaN(val)) {
            firstValid = val;
            break;
        }
    }

    if (firstValid === null) return arr;

    return arr.map(val => {
        if (val == null || Number.isNaN(val)) return val;
        return val - firstValid;
    });
}

/**
 * Convert an array to percentage changes (bar-to-bar)
 * Used for indicators like Chaikin Oscillator where the absolute values
 * depend on historical data we don't have access to
 */
function toPercentageChanges(arr: (number | null | undefined)[]): (number | null | undefined)[] {
    const result: (number | null | undefined)[] = [null]; // First value has no change

    for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const curr = arr[i];

        if (prev == null || curr == null || Number.isNaN(prev) || Number.isNaN(curr) || prev === 0) {
            result.push(null);
        } else {
            result.push((curr - prev) / Math.abs(prev));
        }
    }

    return result;
}

/**
 * Compare two arrays of values with a tolerance
 * Handles null/undefined values gracefully
 * normalize options:
 *   - false: no normalization
 *   - true or 'offset': both arrays normalized by subtracting first valid value (for OBV)
 *   - 'pctChange': compare percentage changes bar-to-bar (for Chaikin Oscillator)
 */
export function compareArrays(
  actual: (number | null | undefined)[],
  expected: (number | null | undefined)[],
  tolerance: number = 1e-4,
  skipInitialValues: number = 0,
  normalize: boolean | 'offset' | 'pctChange' = false
): ComparisonResult {
    // Normalize arrays if requested (for cumulative indicators)
    let actualValues: (number | null | undefined)[];
    let expectedValues: (number | null | undefined)[];

    if (normalize === 'pctChange') {
        actualValues = toPercentageChanges(actual);
        expectedValues = toPercentageChanges(expected);
    } else if (normalize === true || normalize === 'offset') {
        actualValues = normalizeArray(actual);
        expectedValues = normalizeArray(expected);
    } else {
        actualValues = actual;
        expectedValues = expected;
    }
    const totalValues = Math.min(actualValues.length, expectedValues.length);
  let validComparisons = 0;
  let mismatches = 0;
  let sumDifference = 0;
  let maxDifference = 0;
  const failedIndices: number[] = [];

  for (let i = skipInitialValues; i < totalValues; i++) {
      const actualVal = actualValues[i];
      const expectedVal = expectedValues[i];

    // Skip if either value is null/undefined
    if (actualVal == null || expectedVal == null) {
      continue;
    }

    validComparisons++;
    const difference = Math.abs(actualVal - expectedVal);
    sumDifference += difference;
    maxDifference = Math.max(maxDifference, difference);

    if (difference > tolerance) {
      mismatches++;
      failedIndices.push(i);
    }
  }

  const avgDifference = validComparisons > 0 ? sumDifference / validComparisons : 0;
  const passed = mismatches === 0;

  return {
    passed,
    totalValues,
    validComparisons,
    mismatches,
    maxDifference,
    avgDifference,
    failedIndices: passed ? undefined : failedIndices,
  };
}

/**
 * Format a comparison result as a readable string
 */
export function formatComparisonResult(
  indicatorName: string,
  result: ComparisonResult,
  showDetails: boolean = false
): string {
  const status = result.passed ? '✓' : '✗';
  let message = `${status} ${indicatorName}: ${result.validComparisons} comparisons, `;

  if (result.passed) {
    message += `all passed (max diff: ${result.maxDifference.toExponential(2)})`;
  } else {
    message += `${result.mismatches} mismatches (max diff: ${result.maxDifference.toExponential(2)}, avg: ${result.avgDifference.toExponential(2)})`;

    if (showDetails && result.failedIndices && result.failedIndices.length > 0) {
      const sampleIndices = result.failedIndices.slice(0, 5);
      message += `\n  Failed at indices: ${sampleIndices.join(', ')}${result.failedIndices.length > 5 ? '...' : ''}`;
    }
  }

  return message;
}

/**
 * Calculate relative tolerance based on value magnitude
 * Useful for indicators with widely varying scales
 */
export function getRelativeTolerance(value: number, relativePercent: number = 0.01): number {
  return Math.abs(value) * relativePercent;
}
