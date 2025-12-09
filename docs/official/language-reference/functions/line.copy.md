### line.copy()

Clones the line object.

Syntax

```
line.copy(id) → series line
```

Arguments

id (series line) Line object.

Example

```
//@version=6  
indicator('Last 100 bars price range', overlay = true)  
LOOKBACK = 100  
highest = ta.highest(LOOKBACK)  
lowest = ta.lowest(LOOKBACK)  
if barstate.islastconfirmedhistory  
    var lineTop = line.new(bar_index[LOOKBACK], highest, bar_index, highest, color = color.green)  
    var lineBottom = line.copy(lineTop)  
    line.set_y1(lineBottom, lowest)  
    line.set_y2(lineBottom, lowest)  
    line.set_color(lineBottom, color.red)
```

Returns

New line ID object which may be passed to line.setXXX and line.getXXX functions.

See also

[line.new](#fun_line.new)[line.delete](#fun_line.delete)
