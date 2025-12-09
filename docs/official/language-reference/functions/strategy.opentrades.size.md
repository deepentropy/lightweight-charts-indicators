### strategy.opentrades.size()

Returns the direction and the number of contracts traded in the open trade. If the value is > 0, the market position was long. If the value is < 0, the market position was short.

Syntax

```
strategy.opentrades.size(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.opentrades.size` Example 1")  
  
// We calculate the max amt of shares we can buy.  
amtShares = math.floor(strategy.equity / close)  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long, qty = amtShares)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Plot the number of contracts in the latest open trade.  
plot(strategy.opentrades.size(strategy.opentrades - 1), "Amount of contracts in latest open trade")
```

Example

```
// Calculates the average profit percentage for all open trades.  
//@version=6  
strategy("`strategy.opentrades.size` Example 2")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Calculate profit for all open trades.  
profitPct = 0.0  
for tradeNo = 0 to strategy.opentrades - 1  
    entryP = strategy.opentrades.entry_price(tradeNo)  
    exitP = close  
    profitPct += (exitP - entryP) / entryP * strategy.opentrades.size(tradeNo) * 100  
  
// Calculate average profit percent for all open trades.  
avgProfitPct = nz(profitPct / strategy.opentrades)  
plot(avgProfitPct)
```

See also

[strategy.closedtrades.size](#fun_strategy.closedtrades.size)[strategy.position\_size](#var_strategy.position_size)[strategy.opentrades](#var_strategy.opentrades)[strategy.closedtrades](#var_strategy.closedtrades)
