### strategy.close\_all()

Creates an order to close an open position completely, regardless of the identifiers of the entry orders that opened or added to it.

This command always generates [market orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders). To exit from a position using price-based orders (e.g., [stop-loss](https://www.tradingview.com/pine-script-docs/concepts/strategies/#take-profit-and-stop-loss) orders), use the [strategy.exit](#fun_strategy.exit) command.

Syntax

```
strategy.close_all(comment, alert_message, immediately, disable_alert) → void
```

Arguments

comment (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the automatically generated exit identifier. The default is an empty string.

alert\_message (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. The default is an empty string.

immediately (series bool) Optional. If [true](#const_true), the closing order executes on the same tick when the strategy places it, ignoring the strategy properties that restrict execution to the opening tick of the following bar. The default is [false](#const_false).

disable\_alert (series bool) Optional. If [true](#const_true) when the command creates an order, the strategy does not trigger an alert when that order fills. This parameter accepts a "series" value, meaning users can control which orders trigger alerts when they execute. The default is [false](#const_false).

Example

```
//@version=6  
strategy("Multi-entry close strategy")  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
// Place a market order to enter a long trade every time `sma14` crosses over `sma28`.  
if ta.crossover(sma14, sma28)  
    strategy.order("My Long Entry ID " + str.tostring(strategy.opentrades), strategy.long)  
  
// Place a market order to close the entire position every 500 bars.  
if bar_index % 500 == 0  
    strategy.close_all()  
  
// Plot the position size.  
plot(strategy.position_size)
```
