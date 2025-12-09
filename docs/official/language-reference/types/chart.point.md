### chart.point

Keyword to explicitly declare the type of a variable or parameter as `chart.point`. Scripts can produce `chart.point` instances using the [chart.point.from\_time](#fun_chart.point.from_time), [chart.point.from\_index](#fun_chart.point.from_index), [chart.point.now](#fun_chart.point.now), and [chart.point.new](#fun_chart.point.new) functions.

Fields

index (series int) The x-coordinate of the point, expressed as a bar index value.

time (series int) The x-coordinate of the point, expressed as a UNIX time value, in milliseconds.

price (series float) The y-coordinate of the point.

See also

[polyline](#type_polyline)
