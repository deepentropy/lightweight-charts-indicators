### box.copy()

Clones the box object.

Syntax

```
box.copy(id) → series box
```

Arguments

id (series box) Box object.

Example

```
//@version=6  
indicator('Last 50 bars price ranges', overlay = true)  
LOOKBACK = 50  
highest = ta.highest(LOOKBACK)  
lowest = ta.lowest(LOOKBACK)  
if barstate.islastconfirmedhistory  
    var BoxLast = box.new(bar_index[LOOKBACK], highest, bar_index, lowest, bgcolor = color.new(color.green, 80))  
    var BoxPrev = box.copy(BoxLast)  
    box.set_lefttop(BoxPrev, bar_index[LOOKBACK * 2], highest[50])  
    box.set_rightbottom(BoxPrev, bar_index[LOOKBACK], lowest[50])  
    box.set_bgcolor(BoxPrev, color.new(color.red, 80))
```

See also

[box.new](#fun_box.new)[box.delete](#fun_box.delete)
