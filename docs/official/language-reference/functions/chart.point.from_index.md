### chart.point.from\_index()

Returns a [chart.point](#type_chart.point) object with `index` as its x-coordinate and `price` as its y-coordinate.

Syntax

```
chart.point.from_index(index, price) → chart.point
```

Arguments

index (series int) The x-coordinate of the point, expressed as a bar index value.

price (series int/float) The y-coordinate of the point.

Remarks

The `time` field values of [chart.point](#type_chart.point) instances returned from this function will be [na](#var_na), meaning drawing objects with `xloc` values set to `xloc.bar_time` will not work with them.
