### polyline.new()

Creates a new [polyline](#type_polyline) instance and displays it on the chart, sequentially connecting all of the points in the `points` array with line segments. The segments in the drawing can be straight or curved depending on the `curved` parameter.

Syntax

```
polyline.new(points, curved, closed, xloc, line_color, fill_color, line_style, line_width, force_overlay) → series polyline
```

Arguments

points (array<chart.point>) An array of [chart.point](#type_chart.point) objects for the drawing to sequentially connect.

curved (series bool) If [true](#const_true), the drawing will connect all points from the `points` array using curved line segments. Optional. The default is [false](#const_false).

closed (series bool) If [true](#const_true), the drawing will also connect the first point to the last point from the `points` array, resulting in a closed polyline. Optional. The default is [false](#const_false).

xloc (series string) Determines the field of the [chart.point](#type_chart.point) objects in the `points` array that the polyline will use for its x-coordinates. If [xloc.bar\_index](#const_xloc.bar_index), the polyline will use the `index` field from each point. If [xloc.bar\_time](#const_xloc.bar_time), it will use the `time` field. Optional. The default is [xloc.bar\_index](#const_xloc.bar_index).

line\_color (series color) The color of the line segments. Optional. The default is [color.blue](#const_color.blue).

fill\_color (series color) The fill color of the polyline. Optional. The default is [na](#var_na).

line\_style (series string) The style of the polyline. Possible values: [line.style\_solid](#const_line.style_solid), [line.style\_dotted](#const_line.style_dotted), [line.style\_dashed](#const_line.style_dashed), [line.style\_arrow\_left](#const_line.style_arrow_left), [line.style\_arrow\_right](#const_line.style_arrow_right), [line.style\_arrow\_both](#const_line.style_arrow_both). Optional. The default is [line.style\_solid](#const_line.style_solid).

line\_width (series int) The width of the line segments, expressed in pixels. Optional. The default is 1.

force\_overlay (const bool) If [true](#const_true), the drawing will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("Polylines example", overlay = true)  
  
//@variable If `true`, connects all points in the polyline with curved line segments.  
bool curvedInput = input.bool(false, "Curve Polyline")  
//@variable If `true`, connects the first point in the polyline to the last point.  
bool closedInput = input.bool(true, "Close Polyline")  
//@variable The color of the space filled by the polyline.  
color fillcolor = input.color(color.new(color.blue, 90), "Fill Color")  
  
// Time and price inputs for the polyline's points.  
p1x = input.time(0,  "p1", confirm = true, inline = "p1")  
p1y = input.price(0, "  ", confirm = true, inline = "p1")  
p2x = input.time(0,  "p2", confirm = true, inline = "p2")  
p2y = input.price(0, "  ", confirm = true, inline = "p2")  
p3x = input.time(0,  "p3", confirm = true, inline = "p3")  
p3y = input.price(0, "  ", confirm = true, inline = "p3")  
p4x = input.time(0,  "p4", confirm = true, inline = "p4")  
p4y = input.price(0, "  ", confirm = true, inline = "p4")  
p5x = input.time(0,  "p5", confirm = true, inline = "p5")  
p5y = input.price(0, "  ", confirm = true, inline = "p5")  
  
if barstate.islastconfirmedhistory  
    //@variable An array of `chart.point` objects for the new polyline.  
    var points = array.new<chart.point>()  
    // Push new `chart.point` instances into the `points` array.  
    points.push(chart.point.from_time(p1x, p1y))  
    points.push(chart.point.from_time(p2x, p2y))  
    points.push(chart.point.from_time(p3x, p3y))  
    points.push(chart.point.from_time(p4x, p4y))  
    points.push(chart.point.from_time(p5x, p5y))  
    // Add labels for each `chart.point` in `points`.  
    l1p1 = label.new(points.get(0), text = "p1", xloc = xloc.bar_time, color = na)  
    l1p2 = label.new(points.get(1), text = "p2", xloc = xloc.bar_time, color = na)  
    l2p1 = label.new(points.get(2), text = "p3", xloc = xloc.bar_time, color = na)  
    l2p2 = label.new(points.get(3), text = "p4", xloc = xloc.bar_time, color = na)  
    // Create a new polyline that connects each `chart.point` in the `points` array, starting from the first.  
    polyline.new(points, curved = curvedInput, closed = closedInput, fill_color = fillcolor, xloc = xloc.bar_time)
```

Returns

The ID of a new polyline object that a script can use in other `polyline.*()` functions.

See also

[chart.point.new](#fun_chart.point.new)
