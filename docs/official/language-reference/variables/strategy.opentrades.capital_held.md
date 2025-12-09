### strategy.opentrades.capital\_held

Returns the capital amount currently held by open trades.

Type

series float

Example

```
//@version=6  
strategy(  
   "strategy.opentrades.capital_held example", overlay=false, margin_long=50, margin_short=50,  
   default_qty_type = strategy.percent_of_equity, default_qty_value = 100  
 )  
  
// Enter a short position on the first bar.  
if barstate.isfirst  
    strategy.entry("Short", strategy.short)  
  
// Plot the capital held by the short position.  
plot(strategy.opentrades.capital_held, "Capital held")  
// Highlight the chart background if the position is completely closed by margin calls.  
bgcolor(bar_index > 0 and strategy.opentrades.capital_held == 0 ? color.new(color.red, 60) : na)
```

Remarks

This variable returns [na](#var_na) if the strategy does not simulate funding trades with a portion of the hypothetical account, i.e., if the [strategy](#fun_strategy) function does not include nonzero `margin_long` or `margin_short` arguments.
