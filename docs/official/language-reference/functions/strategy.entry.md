### strategy.entry()

Creates a new order to open or add to a position. If an unfilled order with the same `id` exists, a call to this command modifies that order.

The resulting order's type depends on the `limit` and `stop` parameters. If the call does not contain `limit` or `stop` arguments, it creates a [market order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders) that executes on the next tick. If the call specifies a `limit` value but no `stop` value, it places a [limit order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#limit-orders) that executes after the market price reaches the `limit` value or a better price (lower for buy orders and higher for sell orders). If the call specifies a `stop` value but no `limit` value, it places a [stop order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#stop-and-stop-limit-orders) that executes after the market price reaches the `stop` value or a worse price (higher for buy orders and lower for sell orders). If the call contains `limit` and `stop` arguments, it creates a [stop-limit](https://www.tradingview.com/pine-script-docs/concepts/strategies/#stop-and-stop-limit-orders) order, which generates a limit order at the `limit` price only after the market price reaches the `stop` value or a worse price.

Orders from this command, unlike those from [strategy.order](#fun_strategy.order), are affected by the `pyramiding` parameter of the [strategy](#fun_strategy) declaration statement. Pyramiding specifies the number of concurrent open entries allowed per position. For example, with `pyramiding = 3`, the strategy can have up to three open trades, and the command cannot create orders to open additional trades until at least one existing trade closes.

By default, when a strategy executes an order from this command in the opposite direction of the current market position, it reverses that position. For example, if there is an open long position of five shares, an order from this command with a `qty` of 5 and a `direction` of [strategy.short](#const_strategy.short) triggers the sale of 10 shares to close the long position and open a new five-share short position. Users can change this behavior by specifying an allowed direction with the [strategy.risk\_allow\_entry\_in](#fun_strategy.risk_allow_entry_in) function.

Syntax

```
strategy.entry(id, direction, qty, limit, stop, oca_name, oca_type, comment, alert_message, disable_alert) → void
```

Arguments

id (series string) The identifier of the order, which corresponds to an entry ID in the strategy's trades after the order fills. If the strategy opens a new position after filling the order, the order's ID becomes the [strategy.position\_entry\_name](#var_strategy.position_entry_name) value. Strategy commands can reference the order ID to cancel or modify pending orders and generate exit orders for specific open trades. The Strategy Tester and the chart display the order ID unless the command specifies a `comment` value.

direction (series strategy\_direction) The direction of the trade. Possible values: [strategy.long](#const_strategy.long) for a long trade, [strategy.short](#const_strategy.short) for a short one.

qty (series int/float) Optional. The number of contracts/shares/lots/units in the resulting open trade when the order fills. The default is [na](#var_na), which means that the command uses the `default_qty_type` and `default_qty_value` parameters of the [strategy](#fun_strategy) declaration statement to determine the quantity.

limit (series int/float) Optional. The limit price of the order. If specified, the command creates a limit or stop-limit order, depending on whether the `stop` value is also specified. The default is [na](#var_na), which means the resulting order is not of the limit or stop-limit type.

stop (series int/float) Optional. The stop price of the order. If specified, the command creates a stop or stop-limit order, depending on whether the `limit` value is also specified. The default is [na](#var_na), which means the resulting order is not of the stop or stop-limit type.

oca\_name (series string) Optional. The name of the order's One-Cancels-All (OCA) group. When a pending order with the same `oca_name` and `oca_type` parameters executes, that order affects all unfilled orders in the group. The default is an empty string, which means the order does not belong to an OCA group.

oca\_type (input string) Optional. Specifies how an unfilled order behaves when another pending order with the same `oca_name` and `oca_type` values executes. Possible values: [strategy.oca.cancel](#const_strategy.oca.cancel), [strategy.oca.reduce](#const_strategy.oca.reduce), [strategy.oca.none](#const_strategy.oca.none). The default is [strategy.oca.none](#const_strategy.oca.none).

comment (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the specified `id`. The default is an empty string.

alert\_message (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. The default is an empty string.

disable\_alert (series bool) Optional. If [true](#const_true) when the command creates an order, the strategy does not trigger an alert when that order fills. This parameter accepts a "series" value, meaning users can control which orders trigger alerts when they execute. The default is [false](#const_false).

Example

```
//@version=6  
strategy("Market order strategy", overlay = true)  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
// Place a market order to close the short trade and enter a long position when `sma14` crosses over `sma28`.  
if ta.crossover(sma14, sma28)  
    strategy.entry("My Long Entry ID", strategy.long)  
  
// Place a market order to close the long trade and enter a short position when `sma14` crosses under `sma28`.  
if ta.crossunder(sma14, sma28)  
    strategy.entry("My Short Entry ID", strategy.short)
```

Example

```
//@version=6  
strategy("Limit order strategy", overlay=true, margin_long=100, margin_short=100)  
  
//@variable The distance from the `close` price for each limit order.  
float limitOffsetInput = input.int(100, "Limit offset, in ticks", 1) * syminfo.mintick  
  
//@function Draws a label and line at the specified `price` to visualize a limit order's level.  
drawLimit(float price, bool isLong) =>  
    color col = isLong ? color.blue : color.red  
    label.new(  
         bar_index, price, (isLong ? "Long" : "Short") + " limit order created",  
         style = label.style_label_right, color = col, textcolor = color.white  
     )  
    line.new(bar_index, price, bar_index + 1, price, extend = extend.right, style = line.style_dashed, color = col)  
  
//@function Stops the `l` line from extending further.  
method stopExtend(line l) =>  
    l.set_x2(bar_index)  
    l.set_extend(extend.none)  
  
// Initialize two `line` variables to reference limit line IDs.  
var line longLimit  = na  
var line shortLimit = na  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
if ta.crossover(sma14, sma28)  
    // Cancel any unfilled sell orders with the specified ID.  
    strategy.cancel("My Short Entry ID")  
    //@variable The limit price level. Its value is `limitOffsetInput` ticks below the current `close`.  
    float limitLevel = close - limitOffsetInput  
    // Place a long limit order to close the short trade and enter a long position at the `limitLevel`.  
    strategy.entry("My Long Entry ID", strategy.long, limit = limitLevel)  
    // Make new drawings for the long limit and stop extending the `shortLimit` line.  
    longLimit := drawLimit(limitLevel, isLong = true)  
    shortLimit.stopExtend()  
  
if ta.crossunder(sma14, sma28)  
    // Cancel any unfilled buy orders with the specified ID.  
    strategy.cancel("My Long Entry ID")  
    //@variable The limit price level. Its value is `limitOffsetInput` ticks above the current `close`.  
    float limitLevel = close + limitOffsetInput  
    // Place a short limit order to close the long trade and enter a short position at the `limitLevel`.  
    strategy.entry("My Short Entry ID", strategy.short, limit = limitLevel)  
    // Make new drawings for the short limit and stop extending the `shortLimit` line.  
    shortLimit := drawLimit(limitLevel, isLong = false)  
    longLimit.stopExtend()
```
