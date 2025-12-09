### line.get\_price()

Returns the price level of a line at a given bar index.

Syntax

```
line.get_price(id, x) → series float
```

Arguments

id (series line) Line object.

x (series int) Bar index for which price is required.

Example

```
//@version=6  
indicator("GetPrice", overlay=true)  
var line l = na  
if bar_index == 10  
    l := line.new(0, high[5], bar_index, high)  
plot(line.get_price(l, bar_index), color=color.green)
```

Returns

Price value of line 'id' at bar index 'x'.

Remarks

The line is considered to have been created using 'extend=extend.both'.

This function can only be called for lines created using 'xloc.bar\_index'. If you try to call it for a line created with 'xloc.bar\_time', it will generate an error.

See also

[line.new](#fun_line.new)
