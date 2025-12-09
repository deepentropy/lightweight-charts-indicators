### strategy.closedtrades.exit\_time()

Returns the UNIX time of the closed trade's exit, expressed in milliseconds.

Syntax

```
strategy.closedtrades.exit_time(trade_num) → series int
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.exit_time Example 1")  
  
// Enter long trades on three rising bars; exit on two falling bars.  
if ta.rising(close, 3)  
    strategy.entry("Long", strategy.long)  
if ta.falling(close, 2)  
    strategy.close("Long")  
  
// Calculate the average trade duration.  
avgTradeDuration() =>  
    sumTradeDuration = 0  
    for i = 0 to strategy.closedtrades - 1  
        sumTradeDuration += strategy.closedtrades.exit_time(i) - strategy.closedtrades.entry_time(i)  
    result = nz(sumTradeDuration / strategy.closedtrades)  
  
// Display average duration converted to seconds and formatted using 2 decimal points.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(avgTradeDuration() / 1000, "#.##") + " seconds")
```

Example

```
// Reopens a closed trade after X seconds.  
//@version=6  
strategy("strategy.closedtrades.exit_time Example 2")  
  
// Strategy calls to emulate a single long trade at the first bar.  
if bar_index == 0  
    strategy.entry("Long", strategy.long)  
  
reopenPositionAfter(timeSec) =>  
    if strategy.closedtrades > 0  
        if time - strategy.closedtrades.exit_time(strategy.closedtrades - 1) >= timeSec * 1000  
            strategy.entry("Long", strategy.long)  
  
// Reopen last closed position after 120 sec.  
reopenPositionAfter(120)  
  
if ta.change(strategy.opentrades) != 0  
    strategy.exit("Long", stop = low * 0.9, profit = high * 2.5)
```

See also

[strategy.closedtrades.entry\_time](#fun_strategy.closedtrades.entry_time)
