### chart.right\_visible\_bar\_time

The [time](#var_time) of the rightmost bar currently visible on the chart.

Type

input int

Remarks

Scripts using this variable will automatically re-execute when its value updates to reflect changes in the chart, which can be caused by users scrolling the chart, or new real-time bars.

Alerts created on a script that includes this variable will only use the value assigned to the variable at the moment of the alert's creation, regardless of whether the value changes afterward, which may lead to repainting.

See also

[chart.left\_visible\_bar\_time](#var_chart.left_visible_bar_time)
