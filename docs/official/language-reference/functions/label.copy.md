### label.copy()

Clones the label object.

Syntax

```
label.copy(id) → series label
```

Arguments

id (series label) Label object.

Example

```
//@version=6  
indicator('Last 100 bars highest/lowest', overlay = true)  
LOOKBACK = 100  
highest = ta.highest(LOOKBACK)  
highestBars = ta.highestbars(LOOKBACK)  
lowest = ta.lowest(LOOKBACK)  
lowestBars = ta.lowestbars(LOOKBACK)  
if barstate.islastconfirmedhistory  
    var labelHigh = label.new(bar_index + highestBars, highest, str.tostring(highest), color = color.green)  
    var labelLow = label.copy(labelHigh)  
    label.set_xy(labelLow, bar_index + lowestBars, lowest)  
    label.set_text(labelLow, str.tostring(lowest))  
    label.set_color(labelLow, color.red)  
    label.set_style(labelLow, label.style_label_up)
```

Returns

New label ID object which may be passed to label.setXXX and label.getXXX functions.

See also

[label.new](#fun_label.new)[label.delete](#fun_label.delete)
