### box.set\_left()

Sets the left coordinate of the box.

Syntax

```
box.set_left(id, left) → void
```

Arguments

id (series box) A box object.

left (series int) Bar index or bar time of the left border. Note that objects positioned using [xloc.bar\_index](#const_xloc.bar_index) cannot be drawn further than 500 bars into the future.

See also

[box.new](#fun_box.new)[box.get\_left](#fun_box.get_left)
