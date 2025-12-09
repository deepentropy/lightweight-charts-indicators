### strategy.closedtrades.size()

Returns the direction and the number of contracts traded in the closed trade. If the value is > 0, the market position was long. If the value is < 0, the market position was short.

Syntax

```
strategy.closedtrades.size(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.closedtrades.size` Example 1")  
  
// We calculate the max amt of shares we can buy.  
amtShares = math.floor(strategy.equity / close)  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long, qty = amtShares)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Plot the number of contracts traded in the last closed trade.  
plot(strategy.closedtrades.size(strategy.closedtrades - 1), "Number of contracts traded")
```

Example

```
// Calculates the average profit percentage for all closed trades.  
//@version=6  
strategy("`strategy.closedtrades.size` Example 2")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
  
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

[strategy.opentrades.size](#fun_strategy.opentrades.size)[strategy.position\_size](#var_strategy.position_size)[strategy.closedtrades](#var_strategy.closedtrades)[strategy.opentrades](#var_strategy.opentrades)
