### chart.point.new()

Creates a new [chart.point](#type_chart.point) object with the specified `time`, `index`, and `price`.

Syntax

```
chart.point.new(time, index, price) → chart.point
```

Arguments

time (series int) The x-coordinate of the point, expressed as a UNIX time value, in milliseconds.

index (series int) The x-coordinate of the point, expressed as a bar index value.

price (series int/float) The y-coordinate of the point.

Remarks

Whether a drawing object uses a point's `time` or `index` field as an x-coordinate depends on the `xloc` type used in the function call that returned the drawing.

It's important to note that this function does not verify that the `time` and `index` values refer to the same bar.

See also

[polyline.new](#fun_polyline.new)
