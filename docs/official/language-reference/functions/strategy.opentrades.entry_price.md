### strategy.opentrades.entry\_price()

Returns the price of the open trade's entry.

Syntax

```
strategy.opentrades.entry_price(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.opentrades.entry_price Example 1", overlay = true)  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if ta.crossover(close, ta.sma(close, 14))  
    strategy.entry("Long", strategy.long)  
  
// Return the entry price for the latest closed trade.  
currEntryPrice = strategy.opentrades.entry_price(strategy.opentrades - 1)  
currExitPrice = currEntryPrice * 1.05  
  
if high >= currExitPrice  
    strategy.close("Long")  
  
plot(currEntryPrice, "Long entry price", style = plot.style_linebr)  
plot(currExitPrice, "Long exit price", color.green, style = plot.style_linebr)
```

Example

```
// Calculates the average price for the open position.  
//@version=6  
strategy("strategy.opentrades.entry_price Example 2", pyramiding = 2)  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Calculates the average price for the open position.  
avgOpenPositionPrice() =>  
    sumOpenPositionPrice = 0.0  
    for tradeNo = 0 to strategy.opentrades - 1  
        sumOpenPositionPrice += strategy.opentrades.entry_price(tradeNo) * strategy.opentrades.size(tradeNo) / strategy.position_size  
    result = nz(sumOpenPositionPrice / strategy.opentrades)  
  
plot(avgOpenPositionPrice())
```

See also

[strategy.closedtrades.exit\_price](#fun_strategy.closedtrades.exit_price)
