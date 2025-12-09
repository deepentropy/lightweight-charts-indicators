### line.set\_extend()

Sets extending type of this line object. If extend=[extend.none](#const_extend.none), draws segment starting at point (x1, y1) and ending at point (x2, y2). If extend is equal to [extend.right](#const_extend.right) or [extend.left](#const_extend.left), draws a ray starting at point (x1, y1) or (x2, y2), respectively. If extend=[extend.both](#const_extend.both), draws a straight line that goes through these points.

Syntax

```
line.set_extend(id, extend) → void
```

Arguments

id (series line) Line object.

extend (series string) New extending type.

See also

[extend.none](#const_extend.none)[extend.right](#const_extend.right)[extend.left](#const_extend.left)[extend.both](#const_extend.both)[line.new](#fun_line.new)
