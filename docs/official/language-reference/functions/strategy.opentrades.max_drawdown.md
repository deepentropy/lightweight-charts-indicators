### strategy.opentrades.max\_drawdown()

Returns the maximum drawdown of the open trade, i.e., the maximum possible loss during the trade, expressed in [strategy.account\_currency](#var_strategy.account_currency).

Syntax

```
strategy.opentrades.max_drawdown(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.opentrades.max_drawdown Example 1")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Plot the max drawdown of the latest open trade.  
plot(strategy.opentrades.max_drawdown(strategy.opentrades - 1), "Max drawdown of the latest open trade")
```

Example

```
// Calculates the max trade drawdown value for all open trades.  
//@version=6  
strategy("`strategy.opentrades.max_drawdown` Example 2", pyramiding = 100)  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Get the biggest max trade drawdown value from all of the open trades.  
maxTradeDrawDown() =>  
    maxDrawdown = 0.0  
    for tradeNo = 0 to strategy.opentrades - 1  
        maxDrawdown := math.max(maxDrawdown, strategy.opentrades.max_drawdown(tradeNo))  
    result = maxDrawdown  
  
plot(maxTradeDrawDown(), "Biggest max drawdown")
```

Remarks

The function returns na if trade\_num is not in the range: 0 to strategy.closedtrades - 1.

See also

[strategy.closedtrades.max\_drawdown](#fun_strategy.closedtrades.max_drawdown)[strategy.max\_drawdown](#var_strategy.max_drawdown)
