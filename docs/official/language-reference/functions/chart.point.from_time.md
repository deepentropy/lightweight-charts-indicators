### chart.point.from\_time()

Returns a [chart.point](#type_chart.point) object with `time` as its x-coordinate and `price` as its y-coordinate.

Syntax

```
chart.point.from_time(time, price) → chart.point
```

Arguments

time (series int) The x-coordinate of the point, expressed as a UNIX time value, in milliseconds.

price (series int/float) The y-coordinate of the point.

Remarks

The `index` field values of [chart.point](#type_chart.point) instances returned from this function will be [na](#var_na), meaning drawing objects with `xloc` values set to `xloc.bar_index` will not work with them.
