/**
 * Indicator UI Management
 * Handles indicator selection dropdown and dynamic input generation
 */

import type {Bar} from 'oakscriptjs';
import type { Time, SeriesMarker } from 'lightweight-charts';
import { LineType } from 'lightweight-charts';
import { ChartManager } from './chart';
import { indicatorRegistry, type IndicatorRegistryEntry, type IndicatorCategory, type MarkerData } from '../../src/index';

// Built-in marker shapes supported by lightweight-charts createSeriesMarkers
const BUILTIN_MARKER_SHAPES = new Set(['arrowUp', 'arrowDown', 'circle', 'square']);

/**
 * Use the indicator registry from indicators/index.ts
 * Adding new indicators to the registry will automatically make them available in the UI
 */
const indicators: IndicatorRegistryEntry[] = indicatorRegistry;

type IndicatorGroup = 'standard' | 'candlestick' | 'community';

const groupOrder: { key: IndicatorGroup; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'candlestick', label: 'Candlestick Patterns' },
  { key: 'community', label: 'Community' },
];

const categoryOrder: IndicatorCategory[] = [
  'Moving Averages',
  'Momentum',
  'Oscillators',
  'Trend',
  'Volatility',
  'Volume',
  'Channels & Bands',
  'Candlestick Patterns',
];

/**
 * Group indicators by top-level group, then by category within each group
 */
function groupIndicators(indicators: IndicatorRegistryEntry[]): Map<IndicatorGroup, Map<IndicatorCategory, IndicatorRegistryEntry[]>> {
  const result = new Map<IndicatorGroup, Map<IndicatorCategory, IndicatorRegistryEntry[]>>();

  for (const { key } of groupOrder) {
    const categoryMap = new Map<IndicatorCategory, IndicatorRegistryEntry[]>();
    for (const cat of categoryOrder) categoryMap.set(cat, []);
    result.set(key, categoryMap);
  }

  for (const ind of indicators) {
    const groupKey = ind.group;
    const categoryMap = result.get(groupKey);
    if (categoryMap) {
      const arr = categoryMap.get(ind.category);
      if (arr) arr.push(ind);
    }
  }

  // Sort alphabetically within each category
  for (const [, categoryMap] of result) {
    for (const [, arr] of categoryMap) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return result;
}

/**
 * Indicator UI Manager class
 */
export class IndicatorUI {
  private bars: Bar[] = [];
  private chartManager: ChartManager;
  private container: HTMLElement;
  private currentIndicatorId: string | null = null;
  private currentInputs: Record<string, unknown> = {};

  constructor(container: HTMLElement, chartManager: ChartManager) {
    this.container = container;
    this.chartManager = chartManager;
    this.render();
  }

  /**
   * Set bar data for calculations
   */
  setData(bars: Bar[]): void {
    this.bars = bars;
    this.recalculate();
  }

  /**
   * Render the UI
   */
  private render(): void {
    const grouped = groupIndicators(indicators);

    const sectionsHtml = groupOrder.map(({ key, label }) => {
      const categoryMap = grouped.get(key)!;
      let totalCount = 0;
      for (const [, arr] of categoryMap) totalCount += arr.length;
      if (totalCount === 0) return '';

      const categoriesHtml = Array.from(categoryMap.entries())
        .filter(([, arr]) => arr.length > 0)
        .map(([category, arr]) => `
          <div class="category-group" data-category="${category}">
            <div class="category-header collapsed">
              ${category} <span class="category-count">${arr.length}</span>
            </div>
            <div class="category-items collapsed">
              ${arr.map(ind => `<div class="indicator-item" data-id="${ind.id}" data-name="${ind.name.toLowerCase()}" data-short="${(ind.shortName || ind.id).toLowerCase()}">${ind.name}</div>`).join('')}
            </div>
          </div>
        `).join('');

      return `
        <div class="group-section" data-group="${key}">
          <div class="group-header collapsed">
            ${label} <span class="group-count">${totalCount}</span>
          </div>
          <div class="group-items collapsed">
            ${categoriesHtml}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="indicator-panel">
        <h3>Indicators</h3>
        <input type="text" id="indicator-search" placeholder="Search indicators..." />
        <div id="indicator-list">${sectionsHtml}</div>
        <div id="indicator-inputs" class="indicator-inputs"></div>
      </div>
    `;

    this.setupSearch();
    this.setupGroupToggles();
    this.setupCategoryToggles();
    this.setupItemClicks();
  }

  /**
   * Filter indicators by search query
   */
  private setupSearch(): void {
    const searchInput = this.container.querySelector('#indicator-search') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();

      for (const section of this.container.querySelectorAll('.group-section')) {
        let sectionVisible = 0;

        for (const catGroup of section.querySelectorAll('.category-group')) {
          const items = catGroup.querySelectorAll('.indicator-item');
          let visibleCount = 0;

          for (const item of items) {
            const name = item.getAttribute('data-name') || '';
            const short = item.getAttribute('data-short') || '';
            const matches = !query || name.includes(query) || short.includes(query);
            item.classList.toggle('hidden', !matches);
            if (matches) visibleCount++;
          }

          catGroup.classList.toggle('hidden', visibleCount === 0);

          if (query && visibleCount > 0) {
            catGroup.querySelector('.category-items')!.classList.remove('collapsed');
            catGroup.querySelector('.category-header')!.classList.remove('collapsed');
          }
          sectionVisible += visibleCount;
        }

        section.classList.toggle('hidden', sectionVisible === 0);
        if (query && sectionVisible > 0) {
          section.querySelector('.group-items')!.classList.remove('collapsed');
          section.querySelector('.group-header')!.classList.remove('collapsed');
        }
      }
    });
  }

  /**
   * Toggle group collapse on header click
   */
  private setupGroupToggles(): void {
    for (const header of this.container.querySelectorAll('.group-header')) {
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        (header.nextElementSibling as HTMLElement).classList.toggle('collapsed');
      });
    }
  }

  /**
   * Toggle category collapse on header click
   */
  private setupCategoryToggles(): void {
    const headers = this.container.querySelectorAll('.category-header');
    for (const header of headers) {
      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        const items = header.nextElementSibling as HTMLElement;
        items.classList.toggle('collapsed');
      });
    }
  }

  /**
   * Handle indicator item clicks
   */
  private setupItemClicks(): void {
    const listContainer = this.container.querySelector('#indicator-list')!;
    listContainer.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.indicator-item') as HTMLElement | null;
      if (!item) return;

      const id = item.getAttribute('data-id')!;

      // Toggle: clicking active indicator deselects
      if (this.currentIndicatorId === id) {
        this.selectIndicator(null);
        item.classList.remove('active');
        return;
      }

      // Remove previous active
      const prev = this.container.querySelector('.indicator-item.active');
      if (prev) prev.classList.remove('active');

      item.classList.add('active');
      this.selectIndicator(id);
    });
  }

  /**
   * Select an indicator
   */
  private selectIndicator(indicatorId: string | null): void {
    this.currentIndicatorId = indicatorId;
    this.currentInputs = {};

    const inputsContainer = this.container.querySelector('#indicator-inputs') as HTMLElement;

    if (!indicatorId) {
      inputsContainer.innerHTML = '';
      return;
    }

    const indicator = indicators.find(ind => ind.id === indicatorId);
    if (!indicator) {
      inputsContainer.innerHTML = '';
      return;
    }

    // Set default inputs
    this.currentInputs = { ...indicator.defaultInputs };

    // Render inputs
    this.renderInputs(indicator, inputsContainer);

    // Calculate and display
    this.recalculate();
  }

  /**
   * Render input controls for an indicator
   */
  private renderInputs(indicator: IndicatorRegistryEntry, container: HTMLElement): void {
    // Handle inputConfig as either array or object
    const inputConfigArray = Array.isArray(indicator.inputConfig) ? indicator.inputConfig : [];

    const inputsHtml = inputConfigArray.map((input: any) => {
      const value = this.currentInputs[input.id] ?? input.defval;

      switch (input.type) {
        case 'int':
        case 'float':
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title}:</label>
              <input
                type="number"
                id="input-${input.id}"
                data-input-id="${input.id}"
                value="${value}"
                min="${input.min ?? ''}"
                max="${input.max ?? ''}"
                step="${input.step ?? (input.type === 'float' ? 0.1 : 1)}"
              />
            </div>
          `;

        case 'source':
          // Default source options if not provided
          const sourceOptions = input.options || ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'];
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title}:</label>
              <select id="input-${input.id}" data-input-id="${input.id}">
                ${sourceOptions.map((opt: any) =>
                  `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
                ).join('')}
              </select>
            </div>
          `;

        case 'bool':
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title}:</label>
              <input
                type="checkbox"
                id="input-${input.id}"
                data-input-id="${input.id}"
                ${value ? 'checked' : ''}
              />
            </div>
          `;

        case 'string':
          if (input.options) {
            return `
              <div class="input-group">
                <label for="input-${input.id}">${input.title}:</label>
                <select id="input-${input.id}" data-input-id="${input.id}">
                  ${input.options.map((opt: any) =>
                    `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`
                  ).join('')}
                </select>
              </div>
            `;
          }
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title}:</label>
              <input
                type="text"
                id="input-${input.id}"
                data-input-id="${input.id}"
                value="${value}"
              />
            </div>
          `;

        default:
          return '';
      }
    }).join('');

    container.innerHTML = `
      <h4>${indicator.metadata.title} Settings</h4>
      ${inputsHtml}
    `;

    // Add event listeners
    container.querySelectorAll('[data-input-id]').forEach(element => {
      const inputId = element.getAttribute('data-input-id')!;
      const inputConfig = inputConfigArray.find((c: any) => c.id === inputId);

      if (element.tagName === 'SELECT') {
        element.addEventListener('change', (e) => {
          const target = e.target as HTMLSelectElement;
          this.currentInputs[inputId] = target.value;
          this.recalculate();
        });
      } else if (element.tagName === 'INPUT') {
        const inputEl = element as HTMLInputElement;
        if (inputEl.type === 'checkbox') {
          element.addEventListener('change', () => {
            this.currentInputs[inputId] = inputEl.checked;
            this.recalculate();
          });
        } else if (inputEl.type === 'number') {
          element.addEventListener('input', () => {
            const value = inputConfig?.type === 'int'
              ? parseInt(inputEl.value, 10)
              : parseFloat(inputEl.value);
            if (!isNaN(value)) {
              this.currentInputs[inputId] = value;
              this.recalculate();
            }
          });
        } else {
          element.addEventListener('input', () => {
            this.currentInputs[inputId] = inputEl.value;
            this.recalculate();
          });
        }
      }
    });
  }

  /**
   * Recalculate and update the indicator display
   */
  private recalculate(): void {
    if (!this.currentIndicatorId || this.bars.length === 0) {
      this.chartManager.clearIndicators();
      return;
    }

    const indicator = indicators.find(ind => ind.id === this.currentIndicatorId);
    if (!indicator) {
      return;
    }

    try {
      // Calculate indicator
      const result = indicator.calculate(this.bars, this.currentInputs);

      // Clear previous plots
      this.chartManager.clearIndicators();

      // For non-overlay indicators, all plots share the same pane
      const indicatorPaneIndex = indicator.overlay ? 0 : 1;

      // Route plots based on style
      for (const plotDef of indicator.plotConfig) {
        const plotData = result.plots[plotDef.id];
        const isVisible = this.evaluatePlotVisibility(plotDef, result);

        if (plotData && plotData.length > 0 && isVisible) {
          const seriesConfig = {
            color: plotDef.color,
            lineWidth: plotDef.lineWidth,
            overlay: indicator.overlay,
            paneIndex: indicatorPaneIndex,
          };

          const style = plotDef.style ?? 'line';

          switch (style) {
            case 'histogram':
            case 'columns':
              this.chartManager.setHistogramData(plotDef.id, plotData, seriesConfig);
              break;

            case 'circles':
              this.chartManager.setIndicatorData(plotDef.id, plotData, {
                ...seriesConfig,
                pointMarkersVisible: true,
                lineVisible: false,
              });
              break;

            case 'cross':
              this.chartManager.setCrossPlotData(plotDef.id, plotData, seriesConfig);
              break;

            case 'stepline':
              this.chartManager.setIndicatorData(plotDef.id, plotData, {
                ...seriesConfig,
                lineType: LineType.WithSteps,
              });
              break;

            case 'steplinebr':
              this.chartManager.setLineBrData(plotDef.id, plotData, {
                ...seriesConfig,
                lineType: LineType.WithSteps,
              });
              break;

            case 'area':
              this.chartManager.setAreaPlotData(plotDef.id, plotData, seriesConfig);
              break;

            case 'linebr':
              this.chartManager.setLineBrData(plotDef.id, plotData, seriesConfig);
              break;

            case 'line':
            default:
              this.chartManager.setIndicatorData(plotDef.id, plotData, seriesConfig);
              break;
          }
        }
      }

      // Render hlines if configured
      if (indicator.hlineConfig && indicator.hlineConfig.length > 0) {
        this.chartManager.setHLines(indicator.hlineConfig, indicatorPaneIndex, this.bars);
      }

      // Render fills between hlines if configured
      if (indicator.fillConfig?.length && indicator.hlineConfig) {
        this.chartManager.setFills(indicator.fillConfig, indicator.hlineConfig, indicatorPaneIndex, this.bars);
      }

      // Render plot-to-plot fills (cloud/band) if returned by calculate()
      if (result.fills?.length) {
        this.chartManager.setPlotFills(result.fills, result.plots, indicatorPaneIndex);
      }

      // Route markers — split built-in vs extended shapes
      if (Array.isArray(result.markers) && result.markers.length > 0) {
        const builtinMarkers: SeriesMarker<Time>[] = [];
        const extendedMarkers: MarkerData[] = [];

        for (const m of result.markers as MarkerData[]) {
          if (BUILTIN_MARKER_SHAPES.has(m.shape)) {
            builtinMarkers.push({
              time: m.time as unknown as Time,
              position: m.position,
              shape: m.shape as 'arrowUp' | 'arrowDown' | 'circle' | 'square',
              color: m.color,
              text: m.text ?? '',
              size: m.size,
            });
          } else {
            extendedMarkers.push(m);
          }
        }

        this.chartManager.setMarkers(builtinMarkers, extendedMarkers);
      } else {
        this.chartManager.clearMarkers();
      }

      // Phase 2: barcolor
      if (Array.isArray(result.barColors) && result.barColors.length > 0) {
        this.chartManager.setBarColors(result.barColors);
      }

      // Phase 3: bgcolor
      if (Array.isArray(result.bgColors) && result.bgColors.length > 0) {
        this.chartManager.setBgColors(result.bgColors, indicatorPaneIndex);
      }

      // Phase 4: plotcandle
      if (result.plotCandles) {
        for (const [id, data] of Object.entries(result.plotCandles)) {
          if (Array.isArray(data) && data.length > 0) {
            this.chartManager.setCandlePlotData(id, data as any, indicatorPaneIndex);
          }
        }
      }

      // Phase 6: labels
      if (Array.isArray(result.labels) && result.labels.length > 0) {
        this.chartManager.setLabels(result.labels, indicatorPaneIndex);
      }

      // Phase 7: line drawings
      if (Array.isArray(result.lines) && result.lines.length > 0) {
        this.chartManager.setLineDrawings(result.lines, indicatorPaneIndex);
      }

      // Phase 8: boxes
      if (Array.isArray(result.boxes) && result.boxes.length > 0) {
        this.chartManager.setBoxes(result.boxes, indicatorPaneIndex);
      }

      // Phase 9: tables
      if (Array.isArray(result.tables) && result.tables.length > 0) {
        this.chartManager.setTable(result.tables[0]);
      } else if (result.tables && !Array.isArray(result.tables)) {
        this.chartManager.setTable(result.tables);
      }
    } catch (error) {
      console.error('Error calculating indicator:', error);
    }
  }

  /**
   * Evaluate plot visibility based on plotConfig.visible and plotConfig.display
   */
  private evaluatePlotVisibility(plotDef: any, result: any): boolean {
    // Check display property first - 'none' means hidden
    if (plotDef.display === 'none') {
      return false;
    }

    // No visibility constraint - always visible
    if (plotDef.visible === undefined) {
      return true;
    }

    // Direct boolean
    if (typeof plotDef.visible === 'boolean') {
      return plotDef.visible;
    }

    // String variable reference
    if (typeof plotDef.visible === 'string') {
      const visibleVar = plotDef.visible;

      // Check if it's a direct input
      if (this.currentInputs[visibleVar] !== undefined) {
        return Boolean(this.currentInputs[visibleVar]);
      }

      // Check if result includes computed visibility state
      if (result.visibility && result.visibility[visibleVar] !== undefined) {
        return Boolean(result.visibility[visibleVar]);
      }

      // Fallback: check if plot data has any non-NaN values
      const plotData = result.plots[plotDef.id];
      if (plotData && Array.isArray(plotData)) {
        return plotData.some((p: any) =>
          p.value !== undefined && p.value !== null && !Number.isNaN(p.value)
        );
      }
    }

    return true;
  }
}
