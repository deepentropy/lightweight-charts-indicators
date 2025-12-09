### strategy.order()

Creates a new order to open, add to, or exit from a position. If an unfilled order with the same `id` exists, a call to this command modifies that order.

The resulting order's type depends on the `limit` and `stop` parameters. If the call does not contain `limit` or `stop` arguments, it creates a [market order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders) that executes on the next tick. If the call specifies a `limit` value but no `stop` value, it places a [limit order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#limit-orders) that executes after the market price reaches the `limit` value or a better price (lower for buy orders and higher for sell orders). If the call specifies a `stop` value but no `limit` value, it places a [stop order](https://www.tradingview.com/pine-script-docs/concepts/strategies/#stop-and-stop-limit-orders) that executes after the market price reaches the `stop` value or a worse price (higher for buy orders and lower for sell orders). If the call contains `limit` and `stop` arguments, it creates a [stop-limit](https://www.tradingview.com/pine-script-docs/concepts/strategies/#stop-and-stop-limit-orders) order, which generates a limit order at the `limit` price only after the market price reaches the `stop` value or a worse price.

Orders from this command, unlike those from [strategy.entry](#fun_strategy.entry), are not affected by the `pyramiding` parameter of the [strategy](#fun_strategy) declaration statement. Strategies can open any number of trades in the same direction with calls to this function.

This command does not automatically reverse open positions because it does not exclusively create entry orders like [strategy.entry](#fun_strategy.entry) does. For example, if there is an open long position of five shares, an order from this command with a `qty` of 5 and a `direction` of [strategy.short](#const_strategy.short) triggers the sale of five shares, which closes the position.

Syntax

```
strategy.order(id, direction, qty, limit, stop, oca_name, oca_type, comment, alert_message, disable_alert) → void
```

Arguments

id (series string) The identifier of the order, which corresponds to an entry or exit ID in the strategy's trades after the order fills. If the strategy opens a new position after filling the order, the order's ID becomes the [strategy.position\_entry\_name](#var_strategy.position_entry_name) value. Strategy commands can reference the order ID to cancel or modify pending orders and generate exit orders for specific open trades. The Strategy Tester and the chart display the order ID unless the command specifies a `comment` value.

direction (series strategy\_direction) The direction of the trade. Possible values: [strategy.long](#const_strategy.long) for a long trade, [strategy.short](#const_strategy.short) for a short one.

qty (series int/float) Optional. The number of contracts/shares/lots/units to trade when the order fills. The default is [na](#var_na), which means that the command uses the `default_qty_type` and `default_qty_value` parameters of the [strategy](#fun_strategy) declaration statement to determine the quantity.

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
  
// Place a market order to enter a long position when `sma14` crosses over `sma28`.  
if ta.crossover(sma14, sma28) and strategy.position_size == 0  
    strategy.order("My Long Entry ID", strategy.long)  
  
// Place a market order to sell the same quantity as the long trade when `sma14` crosses under `sma28`,  
// effectively closing the long position.  
if ta.crossunder(sma14, sma28) and strategy.position_size > 0  
    strategy.order("My Long Exit ID", strategy.short)
```

Example

```
//@version=6  
strategy("Limit and stop exit strategy", overlay = true)  
  
//@variable The distance from the long entry price for each short limit order.  
float shortOffsetInput = input.int(200, "Sell limit/stop offset, in ticks", 1) * syminfo.mintick  
  
//@function Draws a label and line at the specified `price` to visualize a limit order's level.  
drawLimit(float price, bool isLong, bool isStop = false) =>  
    color col = isLong ? color.blue : color.red  
    label.new(  
         bar_index, price, (isLong ? "Long " : "Short ") + (isStop ? "stop" : "limit") + " order created",  
         style = label.style_label_right, color = col, textcolor = color.white  
     )  
    line.new(bar_index, price, bar_index + 1, price, extend = extend.right, style = line.style_dashed, color = col)  
  
//@function Stops the `l` line from extending further.  
method stopExtend(line l) =>  
    l.set_x2(bar_index)  
    l.set_extend(extend.none)  
  
// Initialize two `line` variables to reference limit and stop line IDs.  
var line profitLimit = na  
var line lossStop    = na  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
if ta.crossover(sma14, sma28) and strategy.position_size == 0  
    // Place a market order to enter a long position.  
    strategy.order("My Long Entry ID", strategy.long)  
  
if strategy.position_size > 0 and strategy.position_size[1] == 0  
    //@variable The entry price of the long trade.  
    float entryPrice = strategy.opentrades.entry_price(0)  
    // Calculate short limit and stop levels above and below the `entryPrice`.  
    float profitLevel = entryPrice + shortOffsetInput  
    float lossLevel   = entryPrice - shortOffsetInput  
    // Place short limit and stop orders at the `profitLevel` and `lossLevel`.  
    strategy.order("Profit", strategy.short, limit = profitLevel, oca_name = "Bracket", oca_type = strategy.oca.cancel)  
    strategy.order("Loss", strategy.short, stop = lossLevel, oca_name = "Bracket", oca_type = strategy.oca.cancel)  
    // Make new drawings for the `profitLimit` and `lossStop` lines.  
    profitLimit := drawLimit(profitLevel, isLong = false)  
    lossStop    := drawLimit(lossLevel, isLong = false, isStop = true)  
  
if ta.change(strategy.closedtrades) > 0  
    // Stop extending the `profitLimit` and `lossStop` lines.  
    profitLimit.stopExtend()  
    lossStop.stopExtend()
```
