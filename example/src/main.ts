/**
 * Main Application Entry Point
 * Initializes the chart and indicator system
 */

import { loadCSV } from './data-loader';
import { ChartManager } from './chart';
import { IndicatorUI } from './indicator-ui';

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Get container elements
  const chartContainer = document.getElementById('chart-container');
  const indicatorContainer = document.getElementById('indicator-panel');

  if (!chartContainer || !indicatorContainer) {
    console.error('Required container elements not found');
    return;
  }

  // Show loading state
  chartContainer.innerHTML = '<div class="loading">Loading chart data...</div>';

  try {
    // Initialize chart manager
    chartContainer.innerHTML = '';
    const chartManager = new ChartManager(chartContainer);

    // Initialize indicator UI
    const indicatorUI = new IndicatorUI(indicatorContainer, chartManager);

    // Load data
    const bars = await loadCSV('./data/SPX.csv');
    
    if (bars.length === 0) {
      chartContainer.innerHTML = '<div class="error">No data loaded</div>';
      return;
    }

    console.log(`Loaded ${bars.length} bars of SPX data`);

    // Set data on chart and indicator UI
    chartManager.setCandlestickData(bars);
    indicatorUI.setData(bars);

  } catch (error) {
    console.error('Failed to initialize:', error);
    chartContainer.innerHTML = `<div class="error">Failed to load data: ${error}</div>`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
