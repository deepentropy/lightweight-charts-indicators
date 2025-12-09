### label.set\_x()

Sets bar index or bar time (depending on the xloc) of the label position.

Syntax

```
label.set_x(id, x) → void
```

Arguments

id (series label) Label object.

x (series int) New bar index or bar time of the label position. Note that objects positioned using [xloc.bar\_index](#const_xloc.bar_index) cannot be drawn further than 500 bars into the future.

See also

[label.new](#fun_label.new)
