### strategy.closedtrades.exit\_bar\_index()

Returns the bar\_index of the closed trade's exit.

Syntax

```
strategy.closedtrades.exit_bar_index(trade_num) → series int
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.exit_bar_index Example 1")  
  
// Strategy calls to place a single short trade. We enter the trade at the first bar and exit the trade at 10 bars before the last chart bar.  
if bar_index == 0  
    strategy.entry("Short", strategy.short)  
if bar_index == last_bar_index - 10  
    strategy.close("Short")  
  
// Calculate the amount of bars since the last closed trade.  
barsSinceClosed = strategy.closedtrades > 0 ? bar_index - strategy.closedtrades.exit_bar_index(strategy.closedtrades - 1) : na  
  
plot(barsSinceClosed, "Bars since last closed trade")
```

Example

```
// Calculates the average amount of bars per trade.  
//@version=6  
strategy("strategy.closedtrades.exit_bar_index Example 2")  
  
// Enter long trades on three rising bars; exit on two falling bars.  
if ta.rising(close, 3)  
    strategy.entry("Long", strategy.long)  
if ta.falling(close, 2)  
    strategy.close("Long")  
  
// Function that calculates the average amount of bars per trade.  
avgBarsPerTrade() =>  
    sumBarsPerTrade = 0  
    for tradeNo = 0 to strategy.closedtrades - 1  
        // Loop through all closed trades, starting with the oldest.  
        sumBarsPerTrade += strategy.closedtrades.exit_bar_index(tradeNo) - strategy.closedtrades.entry_bar_index(tradeNo) + 1  
    result = nz(sumBarsPerTrade / strategy.closedtrades)  
  
plot(avgBarsPerTrade())
```

See also

[bar\_index](#var_bar_index)[last\_bar\_index](#var_last_bar_index)
