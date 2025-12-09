### strategy.closedtrades.entry\_id()

Returns the id of the closed trade's entry.

Syntax

```
strategy.closedtrades.entry_id(trade_num) → series string
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("strategy.closedtrades.entry_id Example", overlay = true)  
  
// Enter a short position and close at the previous to last bar.  
if bar_index == 1  
    strategy.entry("Short at bar #" + str.tostring(bar_index), strategy.short)  
if bar_index == last_bar_index - 2  
    strategy.close_all()  
  
// Display ID of the last entry position.  
if barstate.islastconfirmedhistory  
    label.new(last_bar_index, high, "Last Entry ID is: " + strategy.closedtrades.entry_id(strategy.closedtrades - 1))
```

Returns

Returns the id of the closed trade's entry.

Remarks

The function returns na if trade\_num is not in the range: 0 to strategy.closedtrades-1.

See also

[strategy.closedtrades.entry\_bar\_index](#fun_strategy.closedtrades.entry_bar_index)[strategy.closedtrades.entry\_price](#fun_strategy.closedtrades.entry_price)[strategy.closedtrades.entry\_time](#fun_strategy.closedtrades.entry_time)
