### strategy.close()

Creates an order to exit from the part of a position opened by entry orders with a specific identifier. If multiple entries in the position share the same ID, the orders from this command apply to all those entries, starting from the first open trade, when its calls use that ID as the `id` argument.

This command always generates [market orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders). To exit from a position using price-based orders (e.g., [stop-loss](https://www.tradingview.com/pine-script-docs/concepts/strategies/#take-profit-and-stop-loss) orders), use the [strategy.exit](#fun_strategy.exit) command.

Syntax

```
strategy.close(id, comment, qty, qty_percent, alert_message, immediately, disable_alert) → void
```

Arguments

id (series string) The entry identifier of the open trades to close.

comment (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the automatically generated exit identifier. The default is an empty string.

qty (series int/float) Optional. The number of contracts/lots/shares/units to close when an exit order fills. If specified, the command uses this value instead of `qty_percent` to determine the order size. The default is [na](#var_na), which means the order size depends on the `qty_percent` value.

qty\_percent (series int/float) Optional. A value between 0 and 100 representing the percentage of the open trade quantity to close when an exit order fills. The percentage calculation depends on the total size of the open trades with the `id` entry identifier. The command ignores this parameter if the `qty` value is not [na](#var_na). The default is 100.

alert\_message (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. The default is an empty string.

immediately (series bool) Optional. If [true](#const_true), the closing order executes on the same tick when the strategy places it, ignoring the strategy properties that restrict execution to the opening tick of the following bar. The default is [false](#const_false).

disable\_alert (series bool) Optional. If [true](#const_true) when the command creates an order, the strategy does not trigger an alert when that order fills. This parameter accepts a "series" value, meaning users can control which orders trigger alerts when they execute. The default is [false](#const_false).

Example

```
//@version=6  
strategy("Partial close strategy")  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
// Place a market order to enter a long position when `sma14` crosses over `sma28`.  
if ta.crossover(sma14, sma28)  
    strategy.entry("My Long Entry ID", strategy.long)  
  
// Place a market order to close the long trade when `sma14` crosses under `sma28`.  
if ta.crossunder(sma14, sma28)  
    strategy.close("My Long Entry ID", "50% market close", qty_percent = 50)  
  
// Plot the position size.  
plot(strategy.position_size)
```

Remarks

When a position consists of several open trades and the `close_entries_rule` in the [strategy](#fun_strategy) declaration statement is "FIFO" (default), a [strategy.close](#fun_strategy.close) call exits from the position starting with the first open trade. This behavior applies even if the `id` value is the entry ID of different open trades. However, in that case, the maximum exit order size still depends on the trades opened by orders with the `id` identifier. For more information, see [this](https://www.tradingview.com/pine-script-docs/concepts/strategies/#closing-a-market-position) section of our User Manual.
