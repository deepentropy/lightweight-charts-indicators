### strategy.exit()

Creates price-based orders to exit from an open position. If unfilled exit orders with the same `id` exist, calls to this command modify those orders. This command can generate more than one type of exit order, depending on the specified parameters. However, it does not create [market orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders). To exit from a position with a market order, use [strategy.close](#fun_strategy.close) or [strategy.close\_all](#fun_strategy.close_all).

If a call to this command contains a `profit` or `limit` argument, it creates [take-profit](https://www.tradingview.com/pine-script-docs/concepts/strategies/#take-profit-and-stop-loss) orders to exit from applicable trades at the determined price levels or better values (higher for long trades and lower for short ones). If the call contains `loss` or `stop` arguments, it creates [stop-loss](https://www.tradingview.com/pine-script-docs/concepts/strategies/#take-profit-and-stop-loss) orders to exit from applicable trades at the determined levels or worse values (lower for long trades and higher for short ones). Calling this command with `profit` or `limit` and `loss` or `stop` arguments creates an order bracket with both order types.

This command can create [trailing stop](https://www.tradingview.com/pine-script-docs/concepts/strategies/#trailing-stops) orders when its call specifies a `trail_price` or `trail_points` argument and a `trail_offset` argument. A trailing stop order activates when the price moves `trail_points` ticks past the entry price or touches the `trail_price` level. Once activated, the stop follows `trail_offset` ticks behind the market price each time the trade's profit reaches a new high. The stop does not move when the trade does not achieve a new best value.

Each call to this command reserves a portion of the position to close until the strategy fills or cancels its orders. For example, if there is an open position of 50 contracts and a [strategy.exit](#fun_strategy.exit) call specifies a `qty` of 20, that call's orders reserve 20 contracts out of the position. A second call can close a maximum of 30 contracts, even if its `qty` is 50 and one of its orders executes first. This behavior does not affect the orders from other commands, such as [strategy.close](#fun_strategy.close) or [strategy.order](#fun_strategy.order).

If a call to this command occurs before a created entry order's execution, the strategy waits and does not create the exit orders until after the entry order executes.

Syntax

```
strategy.exit(id, from_entry, qty, qty_percent, profit, limit, loss, stop, trail_price, trail_points, trail_offset, oca_name, comment, comment_profit, comment_loss, comment_trailing, alert_message, alert_profit, alert_loss, alert_trailing, disable_alert) → void
```

Arguments

id (series string) The identifier of the orders, which corresponds to an exit ID in the strategy's trades after an order fills. Strategy commands can reference the order ID to cancel or modify pending exit orders. The Strategy Tester and the chart display the order ID unless the command includes a `comment*` argument that applies to the filled order.

from\_entry (series string) Optional. The entry order ID of the trade to exit from. If there is more than one open trade with the specified entry ID, the command generates exit orders for all the entries from before or at the time of the call. The default is an empty string, which means the command generates exit orders for all open trades until the position closes.

qty (series int/float) Optional. The number of contracts/lots/shares/units to close when an exit order fills. If specified, the command uses this value instead of `qty_percent` to determine the order size. The exit orders reserve this quantity from the position, meaning other calls to this command cannot close this portion until the strategy fills or cancels those orders. The default is [na](#var_na), which means the order size depends on the `qty_percent` value.

qty\_percent (series int/float) Optional. A value between 0 and 100 representing the percentage of the open trade quantity to close when an exit order fills. The exit orders reserve this percentage from the applicable open trades, meaning other calls to this command cannot close this portion until the strategy fills or cancels those orders. The percentage calculation depends on the total size of the applicable open trades without considering the reserved amount from other [strategy.exit](#fun_strategy.exit) calls. The command ignores this parameter if the `qty` value is not [na](#var_na). The default is 100.

profit (series int/float) Optional. The take-profit distance, expressed in ticks. If specified, the command creates a limit order to exit the trade `profit` ticks away from the entry price in the favorable direction. The order executes at the calculated price or a better value. If this parameter and `limit` are not [na](#var_na), the command places a take-profit order only at the price level expected to trigger an exit first. The default is [na](#var_na).

limit (series int/float) Optional. The take-profit price. If this parameter and `profit` are not [na](#var_na), the command places a take-profit order only at the price level expected to trigger an exit first. The default is [na](#var_na).

loss (series int/float) Optional. The stop-loss distance, expressed in ticks. If specified, the command creates a stop order to exit the trade `loss` ticks away from the entry price in the unfavorable direction. The order executes at the calculated price or a worse value. If this parameter and `stop` are not [na](#var_na), the command places a stop-loss order only at the price level expected to trigger an exit first. The default is [na](#var_na).

stop (series int/float) Optional. The stop-loss price. If this parameter and `loss` are not [na](#var_na), the command places a stop-loss order only at the price level expected to trigger an exit first. The default is [na](#var_na).

trail\_price (series int/float) Optional. The price of the trailing stop activation level. If the value is more favorable than the entry price, the command creates a trailing stop when the market price reaches that value. If less favorable than the entry price, the command creates the trailing stop immediately when the current market price is equal to or more favorable than the value. If this parameter and `trail_points` are not [na](#var_na), the command sets the activation level using the value expected to activate the stop first. The default is [na](#var_na).

trail\_points (series int/float) Optional. The trailing stop activation distance, expressed in ticks. If the value is positive, the command creates a trailing stop order when the market price moves `trail_points` ticks away from the trade's entry price in the favorable direction. If the value is negative, the command creates the trailing stop immediately when the market price is equal to or more favorable than the level `trail_points` ticks away from the entry price in the unfavorable direction. The default is [na](#var_na).

trail\_offset (series int/float) Optional. The trailing stop offset. When the market price reaches the activation level determined by the `trail_price` or `trail_points` parameter, or exceeds the level in the favorable direction, the command creates a trailing stop with an initial value `trail_offset` ticks away from that level in the unfavorable direction. After activation, the trailing stop moves toward the market price each time the trade's profit reaches a better value, maintaining the specified distance behind the best price. The default is [na](#var_na).

oca\_name (series string) Optional. The name of the One-Cancels-All (OCA) group that the command's take-profit, stop-loss, and trailing stop orders belong to. All orders from this command are of the [strategy.oca.reduce](#const_strategy.oca.reduce) OCA type. When an order of this OCA type with the same `oca_name` executes, the strategy reduces the sizes of other unfilled orders in the OCA group by the filled quantity. The default is an empty string, which means the strategy assigns the OCA name automatically, and the resulting orders cannot reduce or be reduced by the orders from other commands.

comment (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the specified `id`. The command ignores this value if the call includes an argument for a `comment_*` parameter that applies to the order. The default is an empty string.

comment\_profit (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the specified `id` or `comment`. This comment applies only to the command's take-profit orders created using the `profit` or `limit` parameter. The default is an empty string.

comment\_loss (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the specified `id` or `comment`. This comment applies only to the command's stop-loss orders created using the `loss` or `stop` parameter. The default is an empty string.

comment\_trailing (series string) Optional. Additional notes on the filled order. If the value is not an empty string, the Strategy Tester and the chart show this text for the order instead of the specified `id` or `comment`. This comment applies only to the command's trailing stop orders created using the `trail_price` or `trail_points` and `trail_offset` parameters. The default is an empty string.

alert\_message (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. The command ignores this value if the call includes an argument for the other `alert_*` parameter that applies to the order. The default is an empty string.

alert\_profit (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. This message applies only to the command's take-profit orders created using the `profit` or `limit` parameter. The default is an empty string.

alert\_loss (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. This message applies only to the command's stop-loss orders created using the `loss` or `stop` parameter. The default is an empty string.

alert\_trailing (series string) Optional. Custom text for the alert that fires when an order fills. If the "Message" field of the "Create Alert" dialog box contains the `{{strategy.order.alert_message}}` placeholder, the alert message replaces the placeholder with this text. This message applies only to the command's trailing stop orders created using the `trail_price` or `trail_points` and `trail_offset` parameters. The default is an empty string.

disable\_alert (series bool) Optional. If [true](#const_true) when the command creates an order, the strategy does not trigger an alert when that order fills. This parameter accepts a "series" value, meaning users can control which orders trigger alerts when they execute. The default is [false](#const_false).

Example

```
//@version=6  
strategy("Exit bracket strategy", overlay = true)  
  
// Inputs that define the profit and loss amount of each trade as a tick distance from the entry price.  
int profitDistanceInput = input.int(100, "Profit distance, in ticks", 1)  
int lossDistanceInput   = input.int(100, "Loss distance, in ticks", 1)  
  
// Variables to track the take-profit and stop-loss price.  
var float takeProfit = na  
var float stopLoss   = na  
  
// Calculate a 14-bar and 28-bar moving average of `close` prices.  
float sma14 = ta.sma(close, 14)  
float sma28 = ta.sma(close, 28)  
  
if ta.crossover(sma14, sma28) and strategy.opentrades == 0  
    // Place a market order to enter a long position.  
    strategy.entry("My Long Entry ID", strategy.long)  
    // Place a take-profit and stop-loss order when the entry order fills.  
    strategy.exit("My Long Exit ID", "My Long Entry ID", profit = profitDistanceInput, loss = lossDistanceInput)  
  
if ta.change(strategy.opentrades) == 1  
    //@variable The long entry price.  
    float entryPrice = strategy.opentrades.entry_price(0)  
    // Update the `takeProfit` and `stopLoss` values.  
    takeProfit := entryPrice + profitDistanceInput * syminfo.mintick  
    stopLoss   := entryPrice - lossDistanceInput * syminfo.mintick  
  
if ta.change(strategy.closedtrades) == 1  
    // Reset the `takeProfit` and `stopLoss`.  
    takeProfit := na  
    stopLoss   := na  
  
// Plot the `takeProfit` and `stopLoss`.  
plot(takeProfit, "Take-profit level", color.green, 2, plot.style_linebr)  
plot(stopLoss, "Stop-loss level", color.red, 2, plot.style_linebr)
```

Example

```
//@version=6  
strategy("Trailing stop strategy", overlay = true)  
  
//@variable The distance required to activate the trailing stop.  
float activationDistanceInput = input.int(100, "Trail activation distance, in ticks") * syminfo.mintick  
//@variable The number of ticks the trailing stop follows behind the price as it reaches new peaks.  
int trailDistanceInput = input.int(100, "Trail distance, in ticks")  
  
//@function Draws a label and line at the specified `price` to visualize a trailing stop order's activation level.  
drawActivation(float price) =>  
    label.new(  
         bar_index, price, "Activation level", style = label.style_label_right,  
         color = color.gray, textcolor = color.white  
     )  
    line.new(  
         bar_index, price, bar_index + 1, price, extend = extend.right, style = line.style_dashed, color = color.gray  
     )  
  
//@function Stops the `l` line from extending further.  
method stopExtend(line l) =>  
    l.set_x2(bar_index)  
    l.set_extend(extend.none)  
  
// The activation line, active trailing stop price, and active trailing stop flag.  
var line activationLine     = na  
var float trailingStopPrice = na  
var bool isActive           = false  
  
if bar_index % 100 == 0 and strategy.opentrades == 0  
    trailingStopPrice := na  
    isActive          := false  
    // Place a market order to enter a long position.  
    strategy.entry("My Long Entry ID", strategy.long)  
    //@variable The activation level's price.  
    float activationPrice = close + activationDistanceInput  
    // Create a trailing stop order that activates the defined number of ticks above the entry price.  
    strategy.exit(  
         "My Long Exit ID", "My Long Entry ID", trail_price = activationPrice, trail_offset = trailDistanceInput,  
         oca_name = "Exit"  
     )  
    // Create new drawings at the `activationPrice`.  
    activationLine := drawActivation(activationPrice)  
  
// Logic for trailing stop visualization.  
if strategy.opentrades == 1  
    // Stop extending the `activationLine` when the stop activates.  
    if not isActive and high > activationLine.get_price(bar_index)  
        isActive := true  
        activationLine.stopExtend()  
    // Update the `trailingStopPrice` while the trailing stop is active.  
    if isActive  
        float offsetPrice = high - trailDistanceInput * syminfo.mintick  
        trailingStopPrice := math.max(nz(trailingStopPrice, offsetPrice), offsetPrice)  
  
// Close the trade with a market order if the trailing stop does not activate before the next 300th bar.  
if not isActive and bar_index % 300 == 0  
    strategy.close_all("Market close")  
  
// Reset the `trailingStopPrice` and `isActive` flags when the trade closes, and stop extending the `activationLine`.  
if ta.change(strategy.closedtrades) > 0  
    if not isActive  
        activationLine.stopExtend()  
    trailingStopPrice := na  
    isActive          := false  
  
// Plot the `trailingStopPrice`.  
plot(trailingStopPrice, "Trailing stop", color.red, 3, plot.style_linebr)
```

Remarks

A single call to the [strategy.exit](#fun_strategy.exit) command can generate exit orders for several entries in an open position, depending on the call's `from_entry` value. If the call does not include a `from_entry` argument, it creates exit orders for all open trades, even the ones opened after the call, until the position closes. See [this](https://www.tradingview.com/pine-script-docs/concepts/strategies/#exits-for-multiple-entries) section of our User Manual to learn more.

When a position consists of several open trades, and the `close_entries_rule` in the [strategy](#fun_strategy) declaration statement is "FIFO" (default), the orders from a [strategy.exit](#fun_strategy.exit) call exit from the position starting with the first open trade. This behavior applies even if the `from_entry` value is the entry ID of different open trades. However, in that case, the maximum size of the exit orders still depends on the trades opened by orders with the `from_entry` ID. For more information, see [this](https://www.tradingview.com/pine-script-docs/concepts/strategies/#closing-a-market-position) section of our User Manual.

If a [strategy.exit](#fun_strategy.exit) call includes arguments for creating stop-loss and trailing stop orders, the command places only the order that is supposed to fill first, because both orders are of the "stop" type.
