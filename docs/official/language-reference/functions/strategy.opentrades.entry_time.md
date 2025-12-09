### strategy.opentrades.entry\_time()

Returns the UNIX time of the open trade's entry, expressed in milliseconds.

Syntax

```
strategy.opentrades.entry_time(trade_num) → series int
```

Arguments

trade\_num (series int) The trade number of the open trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.opentrades.entry_time Example")  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long)  
if bar_index % 20 == 0  
    strategy.close("Long")  
  
// Calculates duration in milliseconds since the last position was opened.  
timeSinceLastEntry()=>  
    strategy.opentrades > 0 ? (time - strategy.opentrades.entry_time(strategy.opentrades - 1)) : na  
  
plot(timeSinceLastEntry() / 1000 * 60 * 60 * 24, "Days since last entry")
```

See also

[strategy.closedtrades.entry\_time](#fun_strategy.closedtrades.entry_time)[strategy.closedtrades.exit\_time](#fun_strategy.closedtrades.exit_time)
