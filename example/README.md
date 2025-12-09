# lightweight-charts-indicators Example

This example demonstrates how to use the lightweight-charts-indicators library with LightweightCharts v5 to display technical indicators on a chart.

## Features

- **Candlestick Chart**: Display OHLCV data using LightweightCharts v5
- **Dynamic Indicator Loading**: All indicators from the `indicators/` folder are automatically loaded
- **Dynamic Inputs**: Real-time indicator parameter adjustment
- **Dark Theme**: Professional trading chart appearance

## Quick Start

### Prerequisites

- Node.js 18 or later
- pnpm (recommended) or npm

### Installation

From the example directory:

```bash
# Install dependencies
pnpm install
```

Or from the root of the repository:

```bash
# Install all workspace dependencies
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev
```

Open your browser to `http://localhost:5173` to see the chart.

### Production Build

```bash
# Build for production (local)
pnpm build

# Preview the production build
pnpm preview
```

## Project Structure

```
example/
├── index.html          # Main HTML file
├── public/
│   └── data/
│       └── SPX.csv     # S&P 500 historical data
├── src/
│   ├── main.ts         # Application entry point
│   ├── chart.ts        # LightweightCharts setup and management
│   ├── data-loader.ts  # CSV data loading utilities
│   └── indicator-ui.ts # UI for indicator selection and inputs
└── README.md           # This file
```

## Indicators

Indicators are located in `../src/`. The example uses an **indicator registry** (`src/index.ts`) that automatically populates the dropdown with all available indicators.

## Dependencies

- **oakscriptjs**: Technical analysis library (peer dependency)
- **lightweight-charts-indicators**: This package - technical indicators
- **lightweight-charts**: TradingView's charting library (v5)
- **vite**: Build tool and dev server
- **typescript**: Type safety

## License

MIT
