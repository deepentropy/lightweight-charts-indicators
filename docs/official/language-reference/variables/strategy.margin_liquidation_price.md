### strategy.margin\_liquidation\_price

When margin is used in a strategy, returns the price point where a simulated margin call will occur and liquidate enough of the position to meet the margin requirements.

Type

series float

Example

```
//@version=6  
strategy("Margin call management", overlay = true, margin_long = 25, margin_short = 25,  
  default_qty_type = strategy.percent_of_equity, default_qty_value = 395)  
  
float maFast = ta.sma(close, 14)  
float maSlow = ta.sma(close, 28)  
  
if ta.crossover(maFast, maSlow)  
    strategy.entry("Long", strategy.long)  
  
if ta.crossunder(maFast, maSlow)  
    strategy.entry("Short", strategy.short)  
  
changePercent(v1, v2) =>  
    float result = (v1 - v2) * 100 / math.abs(v2)  
  
// exit when we're 10% away from a margin call, to prevent it.  
if math.abs(changePercent(close, strategy.margin_liquidation_price)) <= 10  
    strategy.close("Long")  
    strategy.close("Short")
```

Remarks

The variable returns [na](#var_na) if the strategy does not use margin, i.e., the [strategy](#fun_strategy) declaration statement does not specify an argument for the `margin_long` or `margin_short` parameter.
