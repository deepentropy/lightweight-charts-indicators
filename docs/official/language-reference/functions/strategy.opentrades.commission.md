### strategy.opentrades.commission()

Returns the sum of entry and exit fees paid in the open trade, expressed in [strategy.account\_currency](#var_strategy.account_currency).

Syntax

```
strategy.opentrades.commission(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
// Calculates the gross profit or loss for the current open position.  
//@version=6  
strategy("`strategy.opentrades.commission` Example", commission_type = strategy.commission.percent, commission_value = 0.1)  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Calculate gross profit or loss for open positions only.  
tradeOpenGrossPL() =>  
    sumOpenGrossPL = 0.0  
    for tradeNo = 0 to strategy.opentrades - 1  
        sumOpenGrossPL += strategy.opentrades.profit(tradeNo) - strategy.opentrades.commission(tradeNo)  
    result = sumOpenGrossPL  
  
plot(tradeOpenGrossPL())
```

See also

[strategy](#fun_strategy)[strategy.closedtrades.commission](#fun_strategy.closedtrades.commission)
