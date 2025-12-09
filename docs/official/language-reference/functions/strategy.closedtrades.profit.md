### strategy.closedtrades.profit()

Returns the profit/loss of the closed trade in the strategy's account currency, reduced by the trade's commissions. A positive returned value represents a profit, and a negative value represents a loss.

Syntax

```
strategy.closedtrades.profit(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.closedtrades.profit()` example")  
  
// Enter a long trade every 15 bars, and close a long trade every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
//@function Calculates the average gross profit from all available closed trades.   
avgGrossProfit() =>  
    var float result = 0.0  
    if result == 0.0 or strategy.closedtrades > strategy.closedtrades[1]  
        float sumGrossProfit = 0.0  
        for tradeNo = 0 to strategy.closedtrades - 1  
            sumGrossProfit += strategy.closedtrades.profit(tradeNo)  
        result := nz(sumGrossProfit / strategy.closedtrades)  
    result  
  
plot(avgGrossProfit(), "Average gross profit")
```

See also

[strategy.account\_currency](#var_strategy.account_currency)[strategy.opentrades.profit](#fun_strategy.opentrades.profit)[strategy.closedtrades.commission](#fun_strategy.closedtrades.commission)
