### strategy.closedtrades.exit\_id()

Returns the id of the closed trade's exit.

Syntax

```
strategy.closedtrades.exit_id(trade_num) → series string
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.exit_id Example", overlay = true)  
  
// Strategy calls to create single short and long trades  
if bar_index == last_bar_index - 15  
    strategy.entry("Long Entry", strategy.long)  
else if bar_index == last_bar_index - 10  
    strategy.entry("Short Entry", strategy.short)  
  
// When a new open trade is detected then we create the exit strategy corresponding with the matching entry id  
// We detect the correct entry id by determining if a position is long or short based on the position quantity  
if ta.change(strategy.opentrades) != 0  
    posSign = strategy.opentrades.size(strategy.opentrades - 1)  
    strategy.exit(posSign > 0 ? "SL Long Exit" : "SL Short Exit", strategy.opentrades.entry_id(strategy.opentrades - 1), stop = posSign > 0 ? high - ta.tr : low + ta.tr)  
  
// When a new closed trade is detected then we place a label above the bar with the exit info  
if ta.change(strategy.closedtrades) != 0  
    msg = "Trade closed by: " + strategy.closedtrades.exit_id(strategy.closedtrades - 1)  
    label.new(bar_index, high + (3 * ta.tr), msg)
```

Returns

Returns the id of the closed trade's exit.

Remarks

The function returns na if trade\_num is not in the range: 0 to strategy.closedtrades-1.

See also

[strategy.closedtrades.exit\_bar\_index](#fun_strategy.closedtrades.exit_bar_index)[strategy.closedtrades.exit\_price](#fun_strategy.closedtrades.exit_price)[strategy.closedtrades.exit\_time](#fun_strategy.closedtrades.exit_time)
