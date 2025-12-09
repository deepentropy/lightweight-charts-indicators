### strategy.closedtrades.entry\_price()

Returns the price of the closed trade's entry.

Syntax

```
strategy.closedtrades.entry_price(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.entry_price Example 1")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Return the entry price for the latest entry.  
entryPrice = strategy.closedtrades.entry_price(strategy.closedtrades - 1)  
  
plot(entryPrice, "Long entry price")
```

Example

```
// Calculates the average profit percentage for all closed trades.  
//@version=6  
strategy("strategy.closedtrades.entry_price Example 2")  
  
// Strategy calls to create single short and long trades  
if bar_index == last_bar_index - 15  
    strategy.entry("Long Entry", strategy.long)  
else if bar_index == last_bar_index - 10  
    strategy.close("Long Entry")  
    strategy.entry("Short", strategy.short)  
else if bar_index == last_bar_index - 5  
    strategy.close("Short")  
  
// Calculate profit for both closed trades.  
profitPct = 0.0  
for tradeNo = 0 to strategy.closedtrades - 1  
    entryP = strategy.closedtrades.entry_price(tradeNo)  
    exitP = strategy.closedtrades.exit_price(tradeNo)  
    profitPct += (exitP - entryP) / entryP * strategy.closedtrades.size(tradeNo) * 100  
  
// Calculate average profit percent for both closed trades.  
avgProfitPct = nz(profitPct / strategy.closedtrades)  
  
plot(avgProfitPct)
```

See also

[strategy.closedtrades.entry\_price](#fun_strategy.closedtrades.entry_price)[strategy.closedtrades.exit\_price](#fun_strategy.closedtrades.exit_price)[strategy.closedtrades.size](#fun_strategy.closedtrades.size)[strategy.closedtrades](#var_strategy.closedtrades)
