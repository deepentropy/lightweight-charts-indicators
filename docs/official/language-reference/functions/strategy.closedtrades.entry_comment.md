### strategy.closedtrades.entry\_comment()

Returns the comment message of the closed trade's entry, or [na](#var_na) if there is no entry with this `trade_num`.

Syntax

```
strategy.closedtrades.entry_comment(trade_num) → series string
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.closedtrades.entry_comment()` Example", overlay = true)  
  
stopPrice = open * 1.01  
  
longCondition = ta.crossover(ta.sma(close, 14), ta.sma(close, 28))  
  
if (longCondition)  
    strategy.entry("Long", strategy.long, stop = stopPrice, comment = str.tostring(stopPrice, "#.####"))  
    strategy.exit("EXIT", trail_points = 1000, trail_offset = 0)  
  
var testTable = table.new(position.top_right, 1, 3, color.orange, border_width = 1)  
  
if barstate.islastconfirmedhistory or barstate.isrealtime  
    table.cell(testTable, 0, 0, 'Last closed trade:')  
    table.cell(testTable, 0, 1, "Order stop price value: " + strategy.closedtrades.entry_comment(strategy.closedtrades - 1))  
    table.cell(testTable, 0, 2, "Actual Entry Price: " + str.tostring(strategy.closedtrades.entry_price(strategy.closedtrades - 1)))
```

See also

[strategy](#fun_strategy)[strategy.entry](#fun_strategy.entry)[strategy.closedtrades](#var_strategy.closedtrades)
