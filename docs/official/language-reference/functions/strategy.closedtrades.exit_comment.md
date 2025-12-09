### strategy.closedtrades.exit\_comment()

Returns the comment message of the closed trade's exit, or [na](#var_na) if there is no entry with this `trade_num`.

Syntax

```
strategy.closedtrades.exit_comment(trade_num) → series string
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

Example

```
//@version=6  
strategy("`strategy.closedtrades.exit_comment()` Example", overlay = true)  
  
longCondition = ta.crossover(ta.sma(close, 14), ta.sma(close, 28))  
if (longCondition)  
    strategy.entry("Long", strategy.long)  
    strategy.exit("Exit", stop = open * 0.95, limit = close * 1.05, trail_points = 100, trail_offset = 0, comment_profit = "TP", comment_loss = "SL", comment_trailing = "TRAIL")  
  
exitStats() =>  
    int slCount = 0  
    int tpCount = 0  
    int trailCount = 0  
  
    if strategy.closedtrades > 0  
        for i = 0 to strategy.closedtrades - 1  
            switch strategy.closedtrades.exit_comment(i)  
                "TP"    => tpCount    += 1  
                "SL"    => slCount    += 1  
                "TRAIL" => trailCount += 1  
    [slCount, tpCount, trailCount]  
  
var testTable = table.new(position.top_right, 1, 4, color.orange, border_width = 1)  
  
if barstate.islastconfirmedhistory  
    [slCount, tpCount, trailCount] = exitStats()  
    table.cell(testTable, 0, 0, "Closed trades (" + str.tostring(strategy.closedtrades) +") stats:")  
    table.cell(testTable, 0, 1, "Stop Loss: " + str.tostring(slCount))  
    table.cell(testTable, 0, 2, "Take Profit: " + str.tostring(tpCount))  
    table.cell(testTable, 0, 3, "Trailing Stop: " + str.tostring(trailCount))
```

See also

[strategy](#fun_strategy)[strategy.exit](#fun_strategy.exit)[strategy.close](#fun_strategy.close)[strategy.closedtrades](#fun_strategy.closedtrades)
