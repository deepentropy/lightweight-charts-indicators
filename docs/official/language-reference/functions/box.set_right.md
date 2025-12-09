### box.set\_right()

Sets the right coordinate of the box.

Syntax

```
box.set_right(id, right) → void
```

Arguments

id (series box) A box object.

right (series int) Bar index or bar time of the right border. Note that objects positioned using [xloc.bar\_index](#const_xloc.bar_index) cannot be drawn further than 500 bars into the future.

See also

[box.new](#fun_box.new)[box.get\_right](#fun_box.get_right)
