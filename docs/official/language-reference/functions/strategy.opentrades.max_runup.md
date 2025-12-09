### strategy.opentrades.max\_runup()

Returns the maximum run up of the open trade, i.e., the maximum possible profit during the trade, expressed in [strategy.account\_currency](#var_strategy.account_currency).

Syntax

```
strategy.opentrades.max_runup(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.opentrades.max_runup Example 1")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Plot the max runup of the latest open trade.  
plot(strategy.opentrades.max_runup(strategy.opentrades - 1), "Max runup of the latest open trade")
```

Example

```
// Calculates the max trade runup value for all open trades.  
//@version=6  
strategy("strategy.opentrades.max_runup Example 2", pyramiding = 100)  
  
// Enter a long position every 30 bars.  
if bar_index % 30 == 0  
    strategy.entry("Long", strategy.long)  
  
// Calculate biggest max trade runup value from all of the open trades.  
maxOpenTradeRunUp() =>  
    maxRunup = 0.0  
    for tradeNo = 0 to strategy.opentrades - 1  
        maxRunup := math.max(maxRunup, strategy.opentrades.max_runup(tradeNo))  
    result = maxRunup  
  
plot(maxOpenTradeRunUp(), "Biggest max runup of all open trades")
```

See also

[strategy.closedtrades.max\_runup](#fun_strategy.closedtrades.max_runup)[strategy.max\_drawdown](#var_strategy.max_drawdown)
