### line.new()

2 overloads

Creates new line object.

Syntax & Overloads

[```
line.new(first_point, second_point, xloc, extend, color, style, width, force_overlay) → series line
```](#fun_line.new-0)[```
line.new(x1, y1, x2, y2, xloc, extend, color, style, width, force_overlay) → series line
```](#fun_line.new-1)

Arguments

first\_point (chart.point) A [chart.point](#type_chart.point) object that specifies the line's starting coordinate.

second\_point (chart.point) A [chart.point](#type_chart.point) object that specifies the line's ending coordinate.

xloc (series string) See description of **x1** argument. Possible values: [xloc.bar\_index](#const_xloc.bar_index) and [xloc.bar\_time](#const_xloc.bar_time). Default is [xloc.bar\_index](#const_xloc.bar_index).

extend (series string) If extend=[extend.none](#const_extend.none), draws segment starting at point (x1, y1) and ending at point (x2, y2). If extend is equal to [extend.right](#const_extend.right) or [extend.left](#const_extend.left), draws a ray starting at point (x1, y1) or (x2, y2), respectively. If extend=[extend.both](#const_extend.both), draws a straight line that goes through these points. Default value is [extend.none](#const_extend.none).

color (series color) Line color.

style (series string) Line style. Possible values: [line.style\_solid](#const_line.style_solid), [line.style\_dotted](#const_line.style_dotted), [line.style\_dashed](#const_line.style_dashed), [line.style\_arrow\_left](#const_line.style_arrow_left), [line.style\_arrow\_right](#const_line.style_arrow_right), [line.style\_arrow\_both](#const_line.style_arrow_both).

width (series int) Line width in pixels.

force\_overlay (const bool) If [true](#const_true), the drawing will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("line.new")  
var line1 = line.new(0, low, bar_index, high, extend=extend.right)  
var line2 = line.new(time, open, time + 60 * 60 * 24, close, xloc=xloc.bar_time, style=line.style_dashed)  
line.set_x2(line1, 0)  
line.set_xloc(line1, time, time + 60 * 60 * 24, xloc.bar_time)  
line.set_color(line2, color.green)  
line.set_width(line2, 5)
```

Returns

Line ID object which may be passed to line.setXXX and line.getXXX functions.

See also

[line.delete](#fun_line.delete)[line.set\_x1](#fun_line.set_x1)[line.set\_y1](#fun_line.set_y1)[line.set\_xy1](#fun_line.set_xy1)[line.set\_x2](#fun_line.set_x2)[line.set\_y2](#fun_line.set_y2)[line.set\_xy2](#fun_line.set_xy2)[line.set\_xloc](#fun_line.set_xloc)[line.set\_color](#fun_line.set_color)[line.set\_extend](#fun_line.set_extend)[line.set\_style](#fun_line.set_style)[line.set\_width](#fun_line.set_width)
