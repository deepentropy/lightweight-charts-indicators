### box.set\_extend()

Sets extending type of the border of this box object. When [extend.none](#const_extend.none) is used, the horizontal borders start at the left border and end at the right border. With [extend.left](#const_extend.left) or [extend.right](#const_extend.right), the horizontal borders are extended indefinitely to the left or right of the box, respectively. With [extend.both](#const_extend.both), the horizontal borders are extended on both sides.

Syntax

```
box.set_extend(id, extend) → void
```

Arguments

id (series box) A box object.

extend (series string) New extending type.

See also

[box.new](#fun_box.new)[extend.none](#const_extend.none)[extend.right](#const_extend.right)[extend.left](#const_extend.left)[extend.both](#const_extend.both)
