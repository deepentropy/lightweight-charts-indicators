### strategy.opentrades.entry\_bar\_index()

Returns the bar\_index of the open trade's entry.

Syntax

```
strategy.opentrades.entry_bar_index(trade_num) → series int
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
// Wait 10 bars and then close the position.  
//@version=6  
strategy("`strategy.opentrades.entry_bar_index` Example")  
  
barsSinceLastEntry() =>  
    strategy.opentrades > 0 ? bar_index - strategy.opentrades.entry_bar_index(strategy.opentrades - 1) : na  
  
// Enter a long position if there are no open positions.  
if strategy.opentrades == 0  
    strategy.entry("Long", strategy.long)  
  
// Close the long position after 10 bars.  
if barsSinceLastEntry() >= 10  
    strategy.close("Long")
```

See also

[strategy.closedtrades.entry\_bar\_index](#fun_strategy.closedtrades.entry_bar_index)[strategy.closedtrades.exit\_bar\_index](#fun_strategy.closedtrades.exit_bar_index)
