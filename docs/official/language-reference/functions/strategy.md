### strategy()

This declaration statement designates the script as a strategy and sets a number of strategy-related properties.

Syntax

```
strategy(title, shorttitle, overlay, format, precision, scale, pyramiding, calc_on_order_fills, calc_on_every_tick, max_bars_back, backtest_fill_limits_assumption, default_qty_type, default_qty_value, initial_capital, currency, slippage, commission_type, commission_value, process_orders_on_close, close_entries_rule, margin_long, margin_short, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, risk_free_rate, use_bar_magnifier, fill_orders_on_standard_ohlc, max_polylines_count, dynamic_requests, behind_chart) → void
```

Arguments

title (const string) The title of the script. It is displayed on the chart when no `shorttitle` argument is used, and becomes the publication's default title when publishing the script.

shorttitle (const string) The script's display name on charts. If specified, it will replace the `title` argument in most chart-related windows. Optional. The default is the argument used for `title`.

overlay (const bool) If [true](#const_true), the script's visuals appear on the main chart pane if the user adds it to the chart directly, or in another script's pane if the user applies it to that script. If [false](#const_false), the script's visuals appear in a separate pane. Changes to the `overlay` value apply only after the user adds the script to the chart again. Additionally, if the user moves the script to another pane by selecting a "Move to" option in the script's "More" menu, it does not move back to its original pane after any updates to the source code. The default is [false](#const_false). Strategy-specific labels that display entries and exits will be displayed over the main chart regardless of this setting.

format (const string) Specifies the formatting of the script's displayed values. Possible values: [format.inherit](#const_format.inherit), [format.price](#const_format.price), [format.volume](#const_format.volume), [format.percent](#const_format.percent). Optional. The default is [format.inherit](#const_format.inherit).

precision (const int) Specifies the number of digits after the floating point of the script's displayed values. Must be a non-negative integer no greater than 16. If `format` is set to [format.inherit](#const_format.inherit) and `precision` is specified, the format will instead be set to [format.price](#const_format.price). When the function's `format` parameter uses [format.volume](#const_format.volume), the `precision` parameter will not affect the result, as the decimal precision rules defined by [format.volume](#const_format.volume) supersede other precision settings. Optional. The default is inherited from the precision of the chart's symbol.

scale (const scale\_type) The price scale used. Possible values: [scale.right](#const_scale.right), [scale.left](#const_scale.left), [scale.none](#const_scale.none). The [scale.none](#const_scale.none) value can only be applied in combination with `overlay = true`. Optional. By default, the script uses the same scale as the chart.

pyramiding (const int) The maximum number of entries allowed in the same direction. If the value is 0, only one entry order in the same direction can be opened, and additional entry orders are rejected. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is 0.

calc\_on\_order\_fills (const bool) Specifies whether the strategy should be recalculated after an order is filled. If [true](#const_true), the strategy recalculates after an order is filled, as opposed to recalculating only when the bar closes. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is [false](#const_false).

calc\_on\_every\_tick (const bool) Specifies whether the strategy should be recalculated on each realtime tick. If [true](#const_true), when the strategy is running on a realtime bar, it will recalculate on each chart update. If [false](#const_false), the strategy only calculates when the realtime bar closes. The argument used does not affect strategy calculation on historical data. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is [false](#const_false).

max\_bars\_back (const int) The length of the historical buffer the script keeps for every variable and function, which determines how many past values can be referenced using the `[]` history-referencing operator. The required buffer size is automatically detected by the Pine Script® runtime. Using this parameter is only necessary when a runtime error occurs because automatic detection fails. More information on the underlying mechanics of the historical buffer can be found [in our Help Center](https://www.tradingview.com/chart/?solution=43000587849). Optional. The default is 0.

backtest\_fill\_limits\_assumption (const int) Limit order execution threshold in ticks. When it is used, limit orders are only filled if the market price exceeds the order's limit level by the specified number of ticks. Optional. The default is 0.

default\_qty\_type (const string) Specifies the units used for `default_qty_value`. Possible values are: [strategy.fixed](#const_strategy.fixed) for contracts/shares/lots, [strategy.cash](#const_strategy.cash) for currency amounts, or [strategy.percent\_of\_equity](#const_strategy.percent_of_equity) for a percentage of available equity. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is [strategy.fixed](#const_strategy.fixed).

default\_qty\_value (const int/float) The default quantity to trade, in units determined by the argument used with the `default_qty_type` parameter. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is 1.

initial\_capital (const int/float) The amount of funds initially available for the strategy to trade, in units of `currency`. Optional. The default is 1000000.

currency (const string) Currency used by the strategy in currency-related calculations. Market positions are still opened by converting `currency` into the chart symbol's currency. The conversion rate depends on the previous daily value of a corresponding currency pair from the most popular exchange. A spread symbol is used if no exchange provides the rate directly. Possible values: a "string" representing a valid currency code (e.g., "USD" or "USDT") or a constant from the `currency.*` namespace (e.g., [currency.USD](#const_currency.USD) or [currency.USDT](#const_currency.USDT)). The default is [syminfo.currency](#var_syminfo.currency).

slippage (const int) Slippage expressed in ticks. This value is added to or subtracted from the fill price of market/stop orders to make the fill price less favorable for the strategy. E.g., if [syminfo.mintick](#var_syminfo.mintick) is 0.01 and `slippage` is set to 5, a long market order will enter at 5 \* 0.01 = 0.05 points above the actual price. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is 0.

commission\_type (const string) Determines what the number passed to the `commission_value` expresses: [strategy.commission.percent](#const_strategy.commission.percent) for a percentage of the cash volume of the order, [strategy.commission.cash\_per\_contract](#const_strategy.commission.cash_per_contract) for currency per contract, [strategy.commission.cash\_per\_order](#const_strategy.commission.cash_per_order) for currency per order. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is [strategy.commission.percent](#const_strategy.commission.percent).

commission\_value (const int/float) Commission applied to the strategy's orders in units determined by the argument passed to the `commission_type` parameter. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is 0.

process\_orders\_on\_close (const bool) When set to [true](#const_true), generates an additional attempt to execute orders after a bar closes and strategy calculations are completed. If the orders are market orders, the broker emulator executes them before the next bar's open. If the orders are price-dependent, they will only be filled if the price conditions are met. This option is useful if you wish to close positions on the current bar. This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. The default is [false](#const_false).

close\_entries\_rule (const string) Determines the order in which trades are closed. Possible values are: "FIFO" (First-In, First-Out) if the earliest exit order must close the earliest entry order, or "ANY" if the orders are closed based on the `from_entry` parameter of the [strategy.exit](#fun_strategy.exit) function. "FIFO" can only be used with stocks, futures and US forex (NFA Compliance Rule 2-43b), while "ANY" is allowed in non-US forex. Optional. The default is "FIFO".

margin\_long (const int/float) Margin long is the percentage of the purchase price of a security that must be covered by cash or collateral for long positions. Must be a non-negative number. The logic used to simulate margin calls is explained in the [Help Center](https://www.tradingview.com/chart/?solution=43000628599). This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. If the value is 0, the strategy does not enforce any limits on position size. The default is 100, in which case the strategy only uses its own funds and the long positions cannot be margin called.

margin\_short (const int/float) Margin short is the percentage of the purchase price of a security that must be covered by cash or collateral for short positions. Must be a non-negative number. The logic used to simulate margin calls is explained in the [Help Center](https://www.tradingview.com/chart/?solution=43000628599). This setting can also be changed in the strategy's "Settings/Properties" tab. Optional. If the value is 0, the strategy does not enforce any limits on position size. The default is 100, in which case the strategy only uses its own funds. Note that even with no margin used, short positions *can* be margin called if the loss exceeds available funds.

explicit\_plot\_zorder (const bool) Specifies the order in which the script's plots, fills, and hlines are rendered. If [true](#const_true), plots are drawn in the order in which they appear in the script's code, each newer plot being drawn above the previous ones. This only applies to `plot*()` functions, [fill](#fun_fill), and [hline](#fun_hline). Optional. The default is [false](#const_false).

max\_lines\_count (const int) The number of last [line](#type_line) drawings displayed. Possible values: 1-500. Optional. The default is 50.

max\_labels\_count (const int) The number of last [label](#type_label) drawings displayed. Possible values: 1-500. Optional. The default is 50.

max\_boxes\_count (const int) The number of last [box](#type_box) drawings displayed. Possible values: 1-500. Optional. The default is 50.

calc\_bars\_count (const int) Limits the initial calculation of a script to the last number of bars specified. When specified, a "Calculated bars" field will be included in the "Calculation" section of the script's "Settings/Inputs" tab. Optional. The default is 0, in which case the script executes on all available bars.

risk\_free\_rate (const int/float) The risk-free rate of return is the annual percentage change in the value of an investment with minimal or zero risk. It is used to calculate the [Sharpe](https://www.tradingview.com/support/solutions/43000681694) and [Sortino](https://www.tradingview.com/support/solutions/43000681697) ratios. Optional. The default is 2.

use\_bar\_magnifier (const bool) Optional. When [true](#const_true), the [Broker Emulator](https://www.tradingview.com/pine-script-docs/concepts/strategies/#broker-emulator) uses lower timeframe data during backtesting on historical bars to achieve more realistic results. The default is [false](#const_false). Only [Premium](https://www.tradingview.com/gopro/) and higher-tier plans have access to this feature.

fill\_orders\_on\_standard\_ohlc (const bool) When [true](#const_true), forces strategies running on Heikin Ashi charts to fill orders using actual OHLC prices, for more realistic results. Optional. The default is [false](#const_false).

max\_polylines\_count (const int) The number of last [polyline](#type_polyline) drawings displayed. Possible values: 1-100. The count is approximate; more drawings than the specified count may be displayed. Optional. The default is 50.

dynamic\_requests (const bool) Specifies whether the script can dynamically call functions from the `request.*()` namespace. Dynamic `request.*()` calls are allowed within the local scopes of conditional structures (e.g., [if](#kw_if)), loops (e.g., [for](#kw_for)), and exported functions. Additionally, such calls allow "series" arguments for many of their parameters. Optional. The default is [true](#const_true). See the User Manual's [Dynamic requests](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#dynamic-requests) section for more information.

behind\_chart (const bool)  Optional. Controls whether all plots and drawings appear behind the chart display (if [true](#const_true)) or in front of it (if [false](#const_false)). This parameter only takes effect when the `overlay` parameter is `true`. The default is [true](#const_true).

Example

```
//@version=6  
strategy("My strategy", overlay = true)  
  
// Enter long by market if current open is greater than previous high.  
if open > high[1]  
    strategy.entry("Long", strategy.long, 1)  
// Generate a full exit bracket (profit 10 points, loss 5 points per contract) from the entry named "Long".  
strategy.exit("Exit", "Long", profit = 10, loss = 5)
```

Remarks

You can learn more about strategies in our [User Manual](https://www.tradingview.com/pine-script-docs/concepts/strategies/).

Every strategy script must have one [strategy](#fun_strategy) call.

Strategies using `calc_on_every_tick = true` parameter may calculate differently on historical and realtime bars, which causes [repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

Strategies always use the chart's prices to enter and exit positions. Using them on non-standard chart types (Heikin Ashi, Renko, etc.) will produce misleading results, as their prices are synthetic. Backtesting on non-standard charts is thus not recommended.

The maximum number of orders a strategy can open, unless it uses Deep Backtesting mode, is 9000. If the strategy exceeds this limit, it removes the oldest order's information when a new entry appears in the "List of Trades" tab. The `strategy.closedtrades.*()` functions return [na](#var_na) for trades opened or closed by removed orders. To retrieve the index of the oldest available closed trade, use the [strategy.closedtrades.first\_index](#var_strategy.closedtrades.first_index) variable.

See also

[indicator](#fun_indicator)[library](#fun_library)
