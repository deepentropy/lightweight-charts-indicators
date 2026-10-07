/**
 * Indicator UI Management
 * Handles indicator selection dropdown and dynamic input generation
 */

import { isInputActive, type Bar, type InputConfig } from 'oakscriptjs';
import { ChartManager } from './chart';
import { parseColor } from '../../src/render/color';
import { indicatorRegistry, type IndicatorRegistryEntry, type IndicatorCategory } from '../../src/index';

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

      // Collapse all groups so the parameters panel is visible
      for (const header of this.container.querySelectorAll('.group-header')) {
        header.classList.add('collapsed');
        (header.nextElementSibling as HTMLElement).classList.add('collapsed');
      }

      // Scroll the inputs panel into view
      const inputsEl = this.container.querySelector('#indicator-inputs');
      if (inputsEl) inputsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const controlsHtml = inputConfigArray.map((input: any) => {
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
        case 'timeframe': // "60", "1D", "" = chart timeframe
        case 'session':
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

        case 'color': {
          // <input type="color"> takes #rrggbb only: the alpha of the colour is kept apart (data-alpha)
          const rgba = parseColor(String(value));
          const hex = rgba
            ? '#' + [rgba.r, rgba.g, rgba.b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')
            : '#000000';
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title}:</label>
              <input
                type="color"
                id="input-${input.id}"
                data-input-id="${input.id}"
                data-alpha="${rgba ? rgba.a : 1}"
                value="${hex}"
              />
            </div>
          `;
        }

        case 'time': {
          // Pine input.time: UNIX time in ms, shown and edited in UTC
          const ms = Number(value);
          const iso = new Date(Number.isFinite(ms) ? ms : 0).toISOString().slice(0, 16);
          return `
            <div class="input-group">
              <label for="input-${input.id}">${input.title} (UTC):</label>
              <input
                type="datetime-local"
                id="input-${input.id}"
                data-input-id="${input.id}"
                value="${iso}"
              />
            </div>
          `;
        }

        default:
          return '';
      }
    });

    // Layout as in the original settings: a header per `group`, inputs sharing an `inline` id on one row
    let inputsHtml = '';
    let lastGroup: string | undefined;
    for (let i = 0; i < inputConfigArray.length; i++) {
      const input = inputConfigArray[i] as InputConfig;
      if (input.group !== lastGroup) {
        if (input.group) inputsHtml += `<div class="input-section">${escapeHtml(input.group)}</div>`;
        lastGroup = input.group;
      }
      if (!input.inline) {
        inputsHtml += controlsHtml[i];
        continue;
      }
      let row = '';
      let j = i;
      for (; j < inputConfigArray.length; j++) {
        const next = inputConfigArray[j] as InputConfig;
        if (next.inline !== input.inline || next.group !== input.group) break;
        row += controlsHtml[j];
      }
      inputsHtml += `<div class="input-row">${row}</div>`;
      i = j - 1;
    }

    container.innerHTML = `
      <h4>${indicator.metadata.title} Settings</h4>
      ${inputsHtml}
    `;

    // Tooltips, untitled inputs (no label) and the `active` state of each input
    const applyActive = () => {
      for (const config of inputConfigArray as InputConfig[]) {
        const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-input-id="${config.id}"]`);
        if (!el) continue;
        const active = isInputActive(config, this.currentInputs, inputConfigArray as InputConfig[]);
        el.disabled = !active;
        el.closest('.input-group')?.classList.toggle('inactive', !active);
      }
    };
    for (const config of inputConfigArray as InputConfig[]) {
      const group = container.querySelector(`[data-input-id="${config.id}"]`)?.closest('.input-group');
      if (!group) continue;
      if (config.tooltip) group.setAttribute('title', config.tooltip);
      if (!config.title) group.querySelector('label')?.remove();
      if (config.type === 'bool' || config.type === 'color') group.classList.add('compact');
    }
    applyActive();
    container.onchange = applyActive; // one handler per container (renderInputs runs again for each indicator)

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
        } else if (inputEl.type === 'color') {
          element.addEventListener('input', () => {
            const alpha = parseFloat(inputEl.dataset.alpha ?? '1');
            const aa = alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : '';
            this.currentInputs[inputId] = inputEl.value + aa;
            this.recalculate();
          });
        } else if (inputEl.type === 'datetime-local') {
          element.addEventListener('change', () => {
            const ms = Date.parse(inputEl.value + ':00Z');
            if (!isNaN(ms)) {
              this.currentInputs[inputId] = ms;
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
      const result = indicator.calculate(this.bars, this.currentInputs);
      this.chartManager.renderIndicator(indicator, result, this.bars, this.currentInputs);
    } catch (error) {
      console.error('Error calculating indicator:', error);
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}
