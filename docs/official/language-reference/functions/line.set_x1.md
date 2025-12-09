### line.set\_x1()

Sets bar index or bar time (depending on the xloc) of the first point.

Syntax

```
line.set_x1(id, x) → void
```

Arguments

id (series line) Line object.

x (series int) Bar index or bar time. Note that objects positioned using [xloc.bar\_index](#const_xloc.bar_index) cannot be drawn further than 500 bars into the future.

See also

[line.new](#fun_line.new)
