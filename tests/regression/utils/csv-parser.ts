/**
 * CSV Parser for reference data with OHLCV and indicator values
 */

export interface OHLCVRow {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [key: string]: string | number | null;
}

// Standard OHLCV columns that should be normalized to lowercase
const OHLCV_COLUMNS = new Set(['time', 'open', 'high', 'low', 'close', 'volume']);

/**
 * Normalize column name - lowercase standard OHLCV columns, preserve others
 */
function normalizeColumnName(name: string): string {
    const lower = name.toLowerCase();
    return OHLCV_COLUMNS.has(lower) ? lower : name;
}

/**
 * Parse CSV file with OHLCV data and indicator reference values
 * Handles column names with spaces
 * Normalizes standard OHLCV column names to lowercase (e.g., "Volume" -> "volume")
 */
export function parseCSV(csvContent: string): OHLCVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

    const headers = lines[0].split(',').map(h => normalizeColumnName(h.trim()));
  const rows: OHLCVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) {
      console.warn(`Row ${i} has ${values.length} values but expected ${headers.length}`);
      continue;
    }

    const row: Partial<OHLCVRow> = {};
    for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
      const value = values[j].trim();

        // Convert to number for all columns except 'time'
      if (header === 'time') {
        row[header] = value;
      } else {
        const numValue = parseFloat(value);
        row[header] = isNaN(numValue) ? null : numValue;
      }
    }
    rows.push(row as OHLCVRow);
  }

  return rows;
}

/**
 * Extract a specific column from the parsed data
 */
export function extractColumn(data: OHLCVRow[], columnName: string): (number | null)[] {
  return data.map(row => {
    const value = row[columnName];
    return typeof value === 'number' ? value : null;
  });
}

/**
 * Get OHLCV data as separate arrays
 */
export function getOHLCV(data: OHLCVRow[]): {
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
} {
  return {
    open: data.map(row => row.open),
    high: data.map(row => row.high),
    low: data.map(row => row.low),
    close: data.map(row => row.close),
    volume: data.map(row => row.volume),
  };
}
