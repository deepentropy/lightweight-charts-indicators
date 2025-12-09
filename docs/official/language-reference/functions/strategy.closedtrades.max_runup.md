### strategy.closedtrades.max\_runup()

Returns the maximum run up of the closed trade, i.e., the maximum possible profit during the trade, expressed in [strategy.account\_currency](#var_strategy.account_currency).

Syntax

```
strategy.closedtrades.max_runup(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.closedtrades.max_runup` Example")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Get the biggest max trade runup value from all of the closed trades.  
maxTradeRunUp() =>  
    maxRunup = 0.0  
    for tradeNo = 0 to strategy.closedtrades - 1  
        maxRunup := math.max(maxRunup, strategy.closedtrades.max_runup(tradeNo))  
    result = maxRunup  
  
plot(maxTradeRunUp(), "Max trade runup")
```

See also

[strategy.opentrades.max\_runup](#fun_strategy.opentrades.max_runup)[strategy.max\_runup](#var_strategy.max_runup)
