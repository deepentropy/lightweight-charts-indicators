### line.set\_xy1()

Sets bar index/time and price of the first point.

Syntax

```
line.set_xy1(id, x, y) → void
```

Arguments

id (series line) Line object.

x (series int) Bar index or bar time. Note that objects positioned using [xloc.bar\_index](#const_xloc.bar_index) cannot be drawn further than 500 bars into the future.

y (series int/float) Price.

See also

[line.new](#fun_line.new)
