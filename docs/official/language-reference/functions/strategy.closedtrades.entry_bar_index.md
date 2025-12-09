### strategy.closedtrades.entry\_bar\_index()

Returns the bar\_index of the closed trade's entry.

Syntax

```
strategy.closedtrades.entry_bar_index(trade_num) → series int
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.entry_bar_index Example")  
// Enter long trades on three rising bars; exit on two falling bars.  
if ta.rising(close, 3)  
    strategy.entry("Long", strategy.long)  
if ta.falling(close, 2)  
    strategy.close("Long")  
// Function that calculates the average amount of bars in a trade.  
avgBarsPerTrade() =>  
    sumBarsPerTrade = 0  
    for tradeNo = 0 to strategy.closedtrades - 1  
        // Loop through all closed trades, starting with the oldest.  
        sumBarsPerTrade += strategy.closedtrades.exit_bar_index(tradeNo) - strategy.closedtrades.entry_bar_index(tradeNo) + 1  
    result = nz(sumBarsPerTrade / strategy.closedtrades)  
plot(avgBarsPerTrade())
```

See also

[strategy.closedtrades.exit\_bar\_index](#fun_strategy.closedtrades.exit_bar_index)[strategy.opentrades.entry\_bar\_index](#fun_strategy.opentrades.entry_bar_index)
